import type { Document } from "./core-types.js"
import { QueryError } from "./errors.js"
import type { QueryOptions } from "./query-options-types.js"
import {
  createQueryResult,
  type QueryTranslator,
  type QueryTranslatorResult,
  type SQLiteBindValue,
} from "./query-translator-types.js"
import type { QueryFilter } from "./query-types.js"
import type { SchemaDefinition, SchemaField } from "./schema-types.js"

/**
 * SQLite-specific query translator for converting StrataDB queries to SQL.
 *
 * @typeParam T - The document type being queried
 *
 * @remarks
 * This translator converts type-safe StrataDB query filters into parameterized
 * SQLite WHERE clauses. It uses generated columns for indexed fields and
 * jsonb_extract for non-indexed fields, ensuring optimal query performance
 * while preventing SQL injection attacks.
 *
 * **Indexed vs Non-Indexed Fields:**
 * - Indexed fields: Use generated column with underscore prefix (e.g., `_age`)
 * - Non-indexed fields: Use `jsonb_extract(data, '$.field')` directly
 *
 * **SQL Injection Prevention:**
 * All user values are extracted into the params array and bound using
 * parameterized queries. No values are ever concatenated into SQL strings.
 *
 * @example
 * ```typescript
 * import { SQLiteQueryTranslator, type Document } from 'stratadb';
 *
 * type User = Document<{
 *   name: string;
 *   age: number;
 *   email: string;
 *   status: 'active' | 'inactive';
 * }>;
 *
 * const schema = createSchema<User>()
 *   .field('name', { type: 'TEXT', indexed: true })
 *   .field('age', { type: 'INTEGER', indexed: true })
 *   .field('email', { type: 'TEXT', indexed: true, unique: true })
 *   .field('status', { type: 'TEXT', indexed: false })
 *   .build();
 *
 * const translator = new SQLiteQueryTranslator(schema);
 *
 * // ✅ Simple equality (indexed field)
 * const result1 = translator.translate({ name: 'Alice' });
 * // => { sql: "_name = ?", params: ['Alice'] }
 *
 * // ✅ Comparison operators (indexed field)
 * const result2 = translator.translate({ age: { $gte: 18, $lt: 65 } });
 * // => { sql: "(_age >= ? AND _age < ?)", params: [18, 65] }
 *
 * // ✅ Non-indexed field uses jsonb_extract
 * const result3 = translator.translate({ status: 'active' });
 * // => { sql: "jsonb_extract(data, '$.status') = ?", params: ['active'] }
 *
 * // ✅ IN operator with multiple values
 * const result4 = translator.translate({ age: { $in: [25, 30, 35] } });
 * // => { sql: "_age IN (?, ?, ?)", params: [25, 30, 35] }
 *
 * // ✅ String operators
 * const result5 = translator.translate({ name: { $startsWith: 'Admin' } });
 * // => { sql: "_name LIKE ?", params: ['Admin%'] }
 *
 * const result6 = translator.translate({ email: { $endsWith: '@company.com' } });
 * // => { sql: "_email LIKE ?", params: ['%@company.com'] }
 *
 * const result7 = translator.translate({ name: { $like: '%Smith%' } });
 * // => { sql: "_name LIKE ?", params: ['%Smith%'] }
 *
 * // ✅ Case-insensitive pattern matching
 * const result8 = translator.translate({ name: { $ilike: '%alice%' } });
 * // => { sql: "_name LIKE ? COLLATE NOCASE", params: ['%alice%'] }
 *
 * // ✅ Substring containment (sugar for $like: '%value%')
 * const result9 = translator.translate({ name: { $contains: 'admin' } });
 * // => { sql: "_name LIKE ?", params: ['%admin%'] }
 * ```
 */
export class SQLiteQueryTranslator<T extends Document>
  implements QueryTranslator<T>
{
  /** Map of field names to their schema definitions */
  private readonly fieldMap: Map<keyof T, SchemaField<T, keyof T>>

  /** Cache for query SQL templates to avoid repeated translation */
  private readonly queryCache: Map<
    string,
    { sql: string; valuePaths: string[] }
  > | null

  /** Maximum cache size before eviction */
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: used for cache eviction logic
  private static readonly MAX_CACHE_SIZE = 500

  /**
   * Creates a new SQLite query translator.
   *
   * @param schema - The schema definition for the document type
   * @param options - Optional configuration options
   * @param options.enableCache - Whether to enable query caching (default: true)
   *
   * @example
   * ```typescript
   * // With caching (default)
   * const translator = new SQLiteQueryTranslator(schema);
   *
   * // Without caching
   * const translator = new SQLiteQueryTranslator(schema, { enableCache: false });
   * ```
   */
  constructor(
    schema: SchemaDefinition<T>,
    options?: { enableCache?: boolean }
  ) {
    // Build field map for quick lookups
    this.fieldMap = new Map()
    for (const field of schema.fields) {
      this.fieldMap.set(field.name, field)
    }

    // Initialize query cache (enabled by default, null when disabled)
    this.queryCache = options?.enableCache !== false ? new Map() : null
  }

  /**
   * Validates and converts a value to a SQLite bind parameter.
   *
   * @param value - The value to validate
   * @returns The value as SQLiteBindValue
   * @throws {QueryError} If value is not a valid SQLite bind type
   *
   * @internal
   */
  private toBindValue(value: unknown): SQLiteBindValue {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "bigint" ||
      value instanceof Uint8Array
    ) {
      return value
    }
    throw new QueryError(
      `Invalid SQLite bind value: cannot bind ${typeof value} type. ` +
        "Expected string, number, boolean, null, bigint, or Uint8Array. " +
        `Received value: ${JSON.stringify(value)}`
    )
  }

  /**
   * Translates a StrataDB query filter to parameterized SQLite SQL.
   *
   * @param filter - The query filter to translate
   * @returns Object containing SQL WHERE clause and parameter values
   *
   * @throws {QueryError} If the filter contains invalid operators or unsupported value types
   *
   * @remarks
   * This method recursively processes the query filter and generates
   * parameterized SQL. All user values are extracted into the params array.
   *
   * **Caching:**
   * Queries with the same structure are cached. On cache hit, only parameter
   * extraction is performed, skipping SQL generation entirely.
   * Note: Queries with $elemMatch, $index, or $all operators are not cached
   * due to their complex value extraction requirements.
   */
  translate(filter: QueryFilter<T>): QueryTranslatorResult {
    // Empty filter matches all documents
    if (!filter || Object.keys(filter).length === 0) {
      return createQueryResult("1=1", [])
    }

    // If caching is disabled, do direct translation
    if (!this.queryCache) {
      const params: SQLiteBindValue[] = []
      const sql = this.translateFilter(filter, params)
      return createQueryResult(sql, params)
    }

    // Check if query contains non-cacheable operators
    if (this.containsNonCacheableOperators(filter)) {
      // Skip cache for complex operators
      const params: SQLiteBindValue[] = []
      const sql = this.translateFilter(filter, params)
      return createQueryResult(sql, params)
    }

    // Generate cache key from query structure
    const cacheKey = this.generateCacheKey(filter)
    const cached = this.queryCache.get(cacheKey)

    if (cached) {
      // Cache hit: extract values using stored paths
      const params = this.extractValuesFromPaths(filter, cached.valuePaths)
      return createQueryResult(cached.sql, params)
    }

    // Cache miss: full translation
    const params: SQLiteBindValue[] = []
    const sql = this.translateFilter(filter, params)

    // Store in cache with value paths
    const valuePaths = this.collectValuePaths(filter)

    // Evict if necessary (simple FIFO)
    if (this.queryCache.size >= SQLiteQueryTranslator.MAX_CACHE_SIZE) {
      const firstKey = this.queryCache.keys().next().value
      if (firstKey) {
        this.queryCache.delete(firstKey)
      }
    }

    this.queryCache.set(cacheKey, { sql, valuePaths })

    return createQueryResult(sql, params)
  }

  /**
   * Checks if a filter contains operators that can't be cached.
   *
   * @param filter - The query filter
   * @returns true if filter contains non-cacheable operators
   *
   * @internal
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: recursive query filter traversal requires complex logic
  private containsNonCacheableOperators(filter: QueryFilter<T>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      // Check logical operators recursively
      if (key === "$and" || key === "$or" || key === "$nor") {
        const filters = value as readonly QueryFilter<T>[]
        for (const f of filters) {
          if (this.containsNonCacheableOperators(f as QueryFilter<T>)) {
            return true
          }
        }
      } else if (key === "$not") {
        if (this.containsNonCacheableOperators(value as QueryFilter<T>)) {
          return true
        }
      } else if (this.isOperatorObject(value)) {
        // Check for non-cacheable operators in field conditions
        const ops = value as Record<string, unknown>
        if ("$elemMatch" in ops || "$index" in ops || "$all" in ops) {
          return true
        }
      }
    }
    return false
  }

  /**
   * Generates a cache key from query structure (ignoring actual values).
   *
   * @param value - Any query value
   * @returns Cache key string representing the structure
   *
   * @internal
   */
  private generateCacheKey(value: unknown): string {
    if (value === null) {
      return "null"
    }

    if (Array.isArray(value)) {
      return `[${value.map((v) => this.generateCacheKey(v)).join(",")}]`
    }

    if (typeof value === "object") {
      const obj = value as Record<string, unknown>
      const keys = Object.keys(obj).sort()
      const parts = keys.map((k) => `${k}:${this.generateCacheKey(obj[k])}`)
      return `{${parts.join(",")}}`
    }

    // For primitive values, just mark the type
    // This allows { name: "Alice" } and { name: "Bob" } to have same key
    return typeof value
  }

  /**
   * Collects all value paths from a query for parameter extraction.
   *
   * @param filter - The query filter
   * @param prefix - Current path prefix
   * @returns Array of paths to values in parameter order
   *
   * @internal
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: recursive query filter traversal requires complex logic
  private collectValuePaths(filter: QueryFilter<T>, prefix = ""): string[] {
    const paths: string[] = []

    for (const [key, value] of Object.entries(filter)) {
      const currentPath = prefix ? `${prefix}.${key}` : key

      if (this.isLogicalOperator(key)) {
        // Logical operators contain arrays of filters
        const filters = value as readonly QueryFilter<T>[]
        for (let i = 0; i < filters.length; i++) {
          const subPaths = this.collectValuePaths(
            filters[i] as QueryFilter<T>,
            `${currentPath}.[${i}]`
          )
          paths.push(...subPaths)
        }
      } else if (key === "$not") {
        const subPaths = this.collectValuePaths(
          value as QueryFilter<T>,
          currentPath
        )
        paths.push(...subPaths)
      } else if (this.isOperatorObject(value)) {
        // Operator object like { $gt: 18, $lt: 65 }
        for (const [op, opValue] of Object.entries(
          value as Record<string, unknown>
        )) {
          if (op === "$exists") {
            // Skip $exists (no value)
            continue
          }

          if (Array.isArray(opValue)) {
            // Array values like $in: [1, 2, 3]
            for (let i = 0; i < opValue.length; i++) {
              paths.push(`${currentPath}.${op}.[${i}]`)
            }
          } else {
            paths.push(`${currentPath}.${op}`)
          }
        }
      } else {
        // Direct value comparison like { name: "Alice" }
        paths.push(currentPath)
      }
    }

    return paths
  }

  /**
   * Extracts values from query filter using stored paths.
   *
   * @param filter - The query filter
   * @param paths - Paths to extract values from
   * @returns Array of values in parameter order
   *
   * @internal
   */
  private extractValuesFromPaths(
    filter: QueryFilter<T>,
    paths: string[]
  ): SQLiteBindValue[] {
    const values: SQLiteBindValue[] = []

    for (const path of paths) {
      const value = this.getValueAtPath(filter, path)
      values.push(this.toBindValue(value))
    }

    return values
  }

  /**
   * Gets a value from a nested object using a dot-separated path.
   *
   * @param obj - The object to traverse
   * @param path - Dot-separated path (e.g., "age.$gt" or "name")
   * @returns The value at the path
   *
   * @internal
   */
  private getValueAtPath(obj: unknown, path: string): unknown {
    const parts = path.split(".")
    let current: unknown = obj

    for (const part of parts) {
      if (current === null || current === undefined) {
        return
      }

      if (part.startsWith("[") && part.endsWith("]")) {
        // Array index
        const index = Number.parseInt(part.slice(1, -1), 10)
        current = (current as unknown[])[index]
      } else {
        current = (current as Record<string, unknown>)[part]
      }
    }

    return current
  }

  /**
   * Checks if a key is a logical operator.
   *
   * @internal
   */
  private isLogicalOperator(key: string): boolean {
    return key === "$and" || key === "$or" || key === "$nor"
  }

  /**
   * Checks if a value is an operator object (contains $ keys).
   *
   * @internal
   */
  private isOperatorObject(value: unknown): boolean {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false
    }
    return Object.keys(value).some((k) => k.startsWith("$"))
  }

  /**
   * Clears the query cache.
   *
   * @remarks
   * Useful for testing or when schema changes require fresh translation.
   * Does nothing if caching is disabled.
   */
  clearCache(): void {
    this.queryCache?.clear()
  }

  /**
   * Returns the current cache size.
   *
   * @remarks
   * Useful for monitoring cache utilization.
   * Returns 0 if caching is disabled.
   */
  get cacheSize(): number {
    return this.queryCache?.size ?? 0
  }

  /**
   * Recursively translates a query filter to SQL.
   *
   * @param filter - The filter to translate
   * @param params - Array to collect parameter values
   * @returns SQL string fragment
   *
   * @internal
   */
  private translateFilter(
    filter: QueryFilter<T>,
    params: SQLiteBindValue[]
  ): string {
    const conditions: string[] = []

    for (const [key, value] of Object.entries(filter)) {
      const condition = this.translateFilterEntry(key, value, params)
      if (condition) {
        conditions.push(condition)
      }
    }

    return conditions.length > 0 ? conditions.join(" AND ") : "1=1"
  }

  /**
   * Translates a single filter entry to SQL.
   *
   * @param key - The filter key (field name or logical operator)
   * @param value - The filter value
   * @param params - Array to collect parameter values
   * @returns SQL string fragment or null
   *
   * @internal
   */
  private translateFilterEntry(
    key: string,
    value: unknown,
    params: SQLiteBindValue[]
  ): string | null {
    // Handle logical operators
    if (key === "$and") {
      const filters = value as readonly QueryFilter<T>[]
      if (filters.length === 0) {
        return "1=1" // Empty $and matches everything (vacuous truth)
      }
      const andConditions = filters.map((f) => this.translateFilter(f, params))
      return `(${andConditions.join(" AND ")})`
    }

    if (key === "$or") {
      const filters = value as readonly QueryFilter<T>[]
      if (filters.length === 0) {
        return "1=1" // Empty $or matches everything
      }
      const orConditions = filters.map((f) => this.translateFilter(f, params))
      return `(${orConditions.join(" OR ")})`
    }

    if (key === "$nor") {
      const filters = value as readonly QueryFilter<T>[]
      if (filters.length === 0) {
        return "1=1" // Empty $nor matches everything
      }
      const norConditions = filters.map((f) => this.translateFilter(f, params))
      return `NOT (${norConditions.join(" OR ")})`
    }

    if (key === "$not") {
      const notCondition = this.translateFilter(value as QueryFilter<T>, params)
      return `NOT (${notCondition})`
    }

    // Handle field conditions
    return this.translateFieldCondition(key as keyof T, value, params)
  }

  /**
   * Translates a field condition to SQL.
   *
   * @param fieldName - The field name
   * @param value - The field value or operators
   * @param params - Array to collect parameter values
   * @returns SQL string fragment or null
   *
   * @internal
   */
  private translateFieldCondition(
    fieldName: keyof T,
    value: unknown,
    params: SQLiteBindValue[]
  ): string | null {
    const fieldSql = this.resolveFieldName(fieldName)

    // Direct value comparison (e.g., { name: 'Alice' })
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      params.push(this.toBindValue(value))
      return `${fieldSql} = ?`
    }

    // Operator conditions (e.g., { age: { $gt: 18 } })
    if (typeof value === "object" && value !== null) {
      const operatorSql = this.translateFieldOperators(
        fieldSql,
        value as Record<string, unknown>,
        params
      )
      return operatorSql || null
    }

    return null
  }

  /**
   * Translates field operators to SQL.
   *
   * @param fieldSql - The SQL representation of the field
   * @param operators - Object containing operators and values
   * @param params - Array to collect parameter values
   * @returns SQL string fragment
   *
   * @internal
   */
  private translateFieldOperators(
    fieldSql: string,
    operators: Record<string, unknown>,
    params: SQLiteBindValue[]
  ): string {
    const conditions: string[] = []

    for (const [op, value] of Object.entries(operators)) {
      const condition = this.translateSingleOperator({
        fieldSql,
        op,
        value,
        operators,
        params,
      })
      if (condition) {
        conditions.push(condition)
      }
    }

    return conditions.length > 0 ? `(${conditions.join(" AND ")})` : ""
  }

  /**
   * Translates a single operator to SQL.
   *
   * @param context - Translation context containing field, operator, value, and params
   * @returns SQL string fragment or null
   *
   * @internal
   */
  private translateSingleOperator(context: {
    fieldSql: string
    op: string
    value: unknown
    operators: Record<string, unknown>
    params: SQLiteBindValue[]
  }): string | null {
    const { fieldSql, op, value, params } = context
    switch (op) {
      case "$eq":
        params.push(this.toBindValue(value))
        return `${fieldSql} = ?`

      case "$ne":
        params.push(this.toBindValue(value))
        return `${fieldSql} != ?`

      case "$gt":
        params.push(this.toBindValue(value))
        return `${fieldSql} > ?`

      case "$gte":
        params.push(this.toBindValue(value))
        return `${fieldSql} >= ?`

      case "$lt":
        params.push(this.toBindValue(value))
        return `${fieldSql} < ?`

      case "$lte":
        params.push(this.toBindValue(value))
        return `${fieldSql} <= ?`

      case "$in":
        return this.translateInOperator(fieldSql, value, params)

      case "$nin":
        return this.translateNotInOperator(fieldSql, value, params)

      case "$like":
        params.push(this.toBindValue(value))
        return `${fieldSql} LIKE ?`

      // Case-insensitive LIKE pattern matching using SQLite's COLLATE NOCASE
      case "$ilike":
        params.push(this.toBindValue(value))
        return `${fieldSql} LIKE ? COLLATE NOCASE`

      // Substring containment: sugar for $like: '%value%'
      case "$contains": {
        const pattern = `%${this.toBindValue(value)}%`
        params.push(pattern)
        return `${fieldSql} LIKE ?`
      }

      case "$startsWith": {
        const pattern = `${this.toBindValue(value)}%`
        params.push(pattern)
        return `${fieldSql} LIKE ?`
      }

      case "$endsWith": {
        const pattern = `%${this.toBindValue(value)}`
        params.push(pattern)
        return `${fieldSql} LIKE ?`
      }

      case "$all":
        return this.translateAllOperator(fieldSql, value, params)

      case "$size":
        return this.translateSizeOperator(fieldSql, value, params)

      case "$elemMatch":
        return this.translateElemMatchOperator(fieldSql, value, params)

      case "$index":
        return this.translateIndexOperator(fieldSql, value, params)

      case "$exists":
        return this.translateExistsOperator(fieldSql, value)

      // Additional operators will be added in subsequent tasks

      default:
        // Unknown operator - ignore
        return null
    }
  }

  /**
   * Translates $in operator to SQL.
   *
   * @param fieldSql - The SQL representation of the field
   * @param values - Array of values to check
   * @param params - Array to collect parameter values
   * @returns SQL string fragment
   *
   * @internal
   */
  private translateInOperator(
    fieldSql: string,
    values: unknown,
    params: SQLiteBindValue[]
  ): string {
    const valuesArray = values as readonly unknown[]
    if (valuesArray.length === 0) {
      // Empty IN clause matches nothing
      return "0=1"
    }

    const placeholders = valuesArray.map(() => "?").join(", ")
    for (const v of valuesArray) {
      params.push(this.toBindValue(v))
    }
    return `${fieldSql} IN (${placeholders})`
  }

  /**
   * Translates $nin operator to SQL.
   *
   * @param fieldSql - The SQL representation of the field
   * @param values - Array of values to exclude
   * @param params - Array to collect parameter values
   * @returns SQL string fragment
   *
   * @internal
   */
  private translateNotInOperator(
    fieldSql: string,
    values: unknown,
    params: SQLiteBindValue[]
  ): string {
    const valuesArray = values as readonly unknown[]
    if (valuesArray.length === 0) {
      // Empty NOT IN clause matches everything
      return "1=1"
    }

    const placeholders = valuesArray.map(() => "?").join(", ")
    for (const v of valuesArray) {
      params.push(this.toBindValue(v))
    }
    return `${fieldSql} NOT IN (${placeholders})`
  }

  /**
   * Resolves field name to SQL column reference.
   *
   * @param fieldName - The field name from the document type
   * @returns SQL column reference (generated column or jsonb_extract)
   *
   * @remarks
   * Indexed fields use generated columns with underscore prefix (e.g., `_age`).
   * Non-indexed fields use `jsonb_extract(data, '$.field')`.
   * Special fields like `_id`, `createdAt`, and `updatedAt` are table columns.
   *
   * @internal
   */
  private resolveFieldName(fieldName: keyof T): string {
    const fieldStr = String(fieldName)

    // Special handling for built-in table columns
    if (
      fieldStr === "_id" ||
      fieldStr === "createdAt" ||
      fieldStr === "updatedAt"
    ) {
      return fieldStr
    }

    const field = this.fieldMap.get(fieldName)

    if (field?.indexed) {
      // Indexed field uses generated column with underscore prefix
      return `_${fieldStr}`
    }

    // Non-indexed field uses jsonb_extract
    return `jsonb_extract(body, '$.${fieldStr}')`
  }

  /**
   * Translates $all operator to SQL.
   *
   * @param fieldSql - The SQL representation of the field
   * @param values - Array of values that must all be present
   * @param params - Array to collect parameter values
   * @returns SQL string fragment
   *
   * @remarks
   * The $all operator matches arrays that contain all specified values.
   * Uses SQLite's json_each to iterate over array elements.
   *
   * @internal
   */
  private translateAllOperator(
    fieldSql: string,
    values: unknown,
    params: SQLiteBindValue[]
  ): string {
    const valuesArray = values as readonly unknown[]
    if (valuesArray.length === 0) {
      // Empty $all matches everything (vacuous truth)
      return "1=1"
    }

    const conditions: string[] = []
    for (const v of valuesArray) {
      params.push(this.toBindValue(v))
      // Check if value exists in the array using json_each
      conditions.push(
        `EXISTS (SELECT 1 FROM json_each(${fieldSql}) WHERE json_each.value = ?)`
      )
    }

    return `(${conditions.join(" AND ")})`
  }

  /**
   * Translates $size operator to SQL.
   *
   * @param fieldSql - The SQL representation of the field
   * @param size - Expected array size
   * @param params - Array to collect parameter values
   * @returns SQL string fragment
   *
   * @remarks
   * The $size operator matches arrays with the specified length.
   * Uses SQLite's json_array_length function.
   *
   * @internal
   */
  private translateSizeOperator(
    fieldSql: string,
    size: unknown,
    params: SQLiteBindValue[]
  ): string {
    params.push(this.toBindValue(size))
    return `json_array_length(${fieldSql}) = ?`
  }

  /**
   * Translates $elemMatch operator to SQL.
   *
   * @param fieldSql - The SQL representation of the field
   * @param elementFilter - Query filter to match array elements
   * @param params - Array to collect parameter values
   * @returns SQL string fragment
   *
   * @remarks
   * The $elemMatch operator matches arrays where at least one element
   * satisfies all the specified query criteria. This requires recursively
   * translating the nested query filter.
   *
   * @internal
   */
  private translateElemMatchOperator(
    fieldSql: string,
    elementFilter: unknown,
    params: SQLiteBindValue[]
  ): string {
    // Extract the nested filter conditions
    const filter = elementFilter as Record<string, unknown>
    const conditions: string[] = []

    for (const [op, value] of Object.entries(filter)) {
      // Use json_each.value to reference array elements
      const elementSql = "json_each.value"
      const condition = this.translateSingleOperator({
        fieldSql: elementSql,
        op,
        value,
        operators: filter,
        params,
      })
      if (condition) {
        conditions.push(condition)
      }
    }

    const whereClause = conditions.join(" AND ")
    return `EXISTS (SELECT 1 FROM json_each(${fieldSql}) WHERE ${whereClause})`
  }

  /**
   * Translates $index operator to SQL.
   *
   * @param fieldSql - The SQL representation of the field
   * @param indexFilter - Object with index and condition
   * @param params - Array to collect parameter values
   * @returns SQL string fragment
   *
   * @remarks
   * The $index operator accesses a specific array element by index.
   * Uses SQLite's json_extract with array index syntax.
   *
   * @internal
   */
  private translateIndexOperator(
    fieldSql: string,
    indexFilter: unknown,
    params: SQLiteBindValue[]
  ): string {
    const filter = indexFilter as { index: number; condition: unknown }
    const index = filter.index
    const condition = filter.condition

    // Extract the element at the specified index
    // For generated columns: json_extract(_field, '$[index]')
    // For non-indexed: json_extract(jsonb_extract(body, '$.field'), '$[index]')
    const elementSql = `json_extract(${fieldSql}, '$[${index}]')`

    // Handle the condition on that element
    if (
      condition === null ||
      typeof condition !== "object" ||
      (Object.getPrototypeOf(condition) !== Object.prototype &&
        Object.getPrototypeOf(condition) !== null)
    ) {
      params.push(this.toBindValue(condition))
      return `${elementSql} = ?`
    }

    // Handle operator conditions
    if (typeof condition === "object" && condition !== null) {
      const operators = condition as Record<string, unknown>
      const conditions: string[] = []

      for (const [op, value] of Object.entries(operators)) {
        const cond = this.translateSingleOperator({
          fieldSql: elementSql,
          op,
          value,
          operators,
          params,
        })
        if (cond) {
          conditions.push(cond)
        }
      }

      return conditions.length > 0 ? `(${conditions.join(" AND ")})` : "1=1"
    }

    return "1=1"
  }

  /**
   * Translates $exists operator to SQL.
   *
   * @param fieldSql - The SQL representation of the field
   * @param shouldExist - Whether field should exist (true) or not (false)
   * @returns SQL string fragment
   *
   * @remarks
   * The $exists operator checks whether a field exists in the document.
   * Uses SQLite's json_type which returns NULL for non-existent fields.
   *
   * @internal
   */
  private translateExistsOperator(
    fieldSql: string,
    shouldExist: unknown
  ): string {
    if (shouldExist === true) {
      // Field exists if json_type is not NULL
      return `json_type(${fieldSql}) IS NOT NULL`
    }
    // Field doesn't exist if json_type is NULL
    return `json_type(${fieldSql}) IS NULL`
  }

  /**
   * Translates query options to SQL clauses.
   *
   * @param options - The query options to translate
   * @returns Object containing SQL clauses (ORDER BY, LIMIT, OFFSET) and parameters
   *
   * @remarks
   * Query options are translated to SQL clauses that control result ordering and pagination.
   * The projection option is handled by the collection layer, not by the translator.
   *
   * **Generated SQL Clauses:**
   * - `sort`: Generates ORDER BY clause with field names and ASC/DESC
   * - `limit`: Generates LIMIT clause with parameterized value
   * - `skip`: Generates OFFSET clause with parameterized value
   *
   * **Field Resolution:**
   * Sort fields use the same resolution as query filters:
   * - Indexed fields: Use generated column `_fieldname`
   * - Non-indexed fields: Use `jsonb_extract(data, '$.fieldname')`
   *
   * **Sort Direction:**
   * - `1`: Ascending order (ASC)
   * - `-1`: Descending order (DESC)
   *
   * @example
   * ```typescript
   * // Sort by age descending, then name ascending
   * translator.translateOptions({
   *   sort: { age: -1, name: 1 },
   *   limit: 10,
   *   skip: 20
   * });
   * // => {
   * //   sql: "ORDER BY _age DESC, _name ASC LIMIT ? OFFSET ?",
   * //   params: [10, 20]
   * // }
   *
   * // Sort with non-indexed field
   * translator.translateOptions({
   *   sort: { status: 1 },
   *   limit: 5
   * });
   * // => {
   * //   sql: "ORDER BY jsonb_extract(data, '$.status') ASC LIMIT ?",
   * //   params: [5]
   * // }
   * ```
   */
  translateOptions(options: QueryOptions<T>): QueryTranslatorResult {
    const params: SQLiteBindValue[] = []
    const clauses: string[] = []

    // Handle sort (ORDER BY clause)
    if (options.sort) {
      const orderBy = this.translateSort(options.sort)
      if (orderBy) {
        clauses.push(orderBy)
      }
    }

    // Handle limit (LIMIT clause)
    if (options.limit !== undefined) {
      params.push(this.toBindValue(options.limit))
      clauses.push("LIMIT ?")
    }

    // Handle skip (OFFSET clause)
    if (options.skip !== undefined) {
      params.push(this.toBindValue(options.skip))
      clauses.push("OFFSET ?")
    }

    // Note: projection is handled by the collection layer during SELECT construction

    return createQueryResult(clauses.join(" "), params)
  }

  /**
   * Translates sort specification to ORDER BY clause.
   *
   * @param sort - Sort specification object
   * @returns ORDER BY SQL string fragment
   *
   * @remarks
   * Converts MongoDB-style sort specification to SQL ORDER BY clause.
   * Uses the same field resolution as query filters to ensure consistency.
   *
   * @internal
   */
  private translateSort(sort: QueryOptions<T>["sort"]): string {
    if (!sort) {
      return ""
    }

    const sortFields: string[] = []

    for (const [fieldName, direction] of Object.entries(sort)) {
      const fieldSql = this.resolveFieldName(fieldName as keyof T)
      const dir = direction === 1 ? "ASC" : "DESC"
      sortFields.push(`${fieldSql} ${dir}`)
    }

    return sortFields.length > 0 ? `ORDER BY ${sortFields.join(", ")}` : ""
  }
}
