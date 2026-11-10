import type { Document } from "./core-types.js"
import { QueryError } from "./errors.js"
import { fieldPath, positional } from "./field-resolver.js"
import {
  createQueryResult,
  type QueryTranslatorResult,
  type SQLiteBindValue,
} from "./query-translator-types.js"
import type { QueryFilter } from "./query-types.js"
import { validateQuery } from "./query-validation.js"
import type { SchemaDefinition, SchemaField } from "./schema-types.js"
/** Query shape caching and value extraction, shared by SQL translation. */
export abstract class QueryTranslationCache<T extends Document> {
  protected abstract translateFilter(
    filter: QueryFilter<T>,
    params: SQLiteBindValue[],
    root?: string
  ): string
  protected readonly fieldMap: Map<keyof T, SchemaField<T, keyof T>>

  protected elementAlias = 0

  protected readonly queryCache: Map<
    string,
    { sql: string; valuePaths: string[] }
  > | null

  protected static readonly MAX_CACHE_SIZE = 500

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
    this.queryCache = options?.enableCache === false ? null : new Map()
  }

  protected toBindValue(value: unknown): SQLiteBindValue {
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

  translate(filter: QueryFilter<T>): QueryTranslatorResult {
    this.elementAlias = 0
    validateQuery(filter)
    // Empty filter matches all documents
    if (!filter || Object.keys(filter).length === 0) {
      return createQueryResult("1=1", [])
    }

    // If caching is disabled, do direct translation
    if (!this.queryCache) {
      const params: SQLiteBindValue[] = []
      const sql = this.translateFilter(filter, params)
      return createQueryResult(
        positional(sql, params).sql,
        positional(sql, params).params
      )
    }

    // Check if query contains non-cacheable operators
    if (this.containsNonCacheableOperators(filter)) {
      // Skip cache for complex operators
      const params: SQLiteBindValue[] = []
      const sql = this.translateFilter(filter, params)
      return createQueryResult(
        positional(sql, params).sql,
        positional(sql, params).params
      )
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
    const rawPaths = this.collectValuePaths(filter)
    const valuePaths = positional(sql, params).indexes.map(
      (index) => rawPaths[index] as string
    )

    // Evict if necessary (simple FIFO)
    if (this.queryCache.size >= QueryTranslationCache.MAX_CACHE_SIZE) {
      const firstKey = this.queryCache.keys().next().value
      if (firstKey) {
        this.queryCache.delete(firstKey)
      }
    }

    this.queryCache.set(cacheKey, {
      sql: positional(sql, params).sql,
      valuePaths,
    })

    return createQueryResult(
      positional(sql, params).sql,
      positional(sql, params).params
    )
  }

  protected containsNonCacheableOperators(filter: QueryFilter<T>): boolean {
    return Object.entries(filter).some(([key, value]) =>
      this.nonCacheableEntry(key, value)
    )
  }
  private nonCacheableEntry(key: string, value: unknown): boolean {
    if (key === "$and" || key === "$or" || key === "$nor") {
      return (value as readonly QueryFilter<T>[]).some((filter) =>
        this.containsNonCacheableOperators(filter)
      )
    }
    if (key === "$not") {
      return this.containsNonCacheableOperators(value as QueryFilter<T>)
    }
    if (!this.isOperatorObject(value)) {
      return false
    }
    const ops = value as Record<string, unknown>
    return [
      "$elemMatch",
      "$index",
      "$all",
      "$contains",
      "$startsWith",
      "$endsWith",
      "$like",
    ].some((op) => op in ops)
  }

  protected generateCacheKey(value: unknown): string {
    if (value === null) {
      return "null"
    }

    if (Array.isArray(value)) {
      return `[${value.map((v) => this.generateCacheKey(v)).join(",")}]`
    }

    if (typeof value === "object") {
      const obj = value as Record<string, unknown>
      const keys = Object.keys(obj)
      const parts = keys.map((k) =>
        k === "$exists"
          ? `${k}:${String(obj[k])}`
          : `${k}:${this.generateCacheKey(obj[k])}`
      )
      return `{${parts.join(",")}}`
    }

    // For primitive values, just mark the type
    // This allows { name: "Alice" } and { name: "Bob" } to have same key
    return typeof value
  }

  protected collectValuePaths(
    filter: QueryFilter<T>,
    prefix: string[] = []
  ): string[] {
    const paths: string[] = []

    for (const [key, value] of Object.entries(filter)) {
      const currentPath = [...prefix, key]

      if (
        !(
          key.startsWith("$") ||
          this.fieldMap.get(key as keyof T)?.indexed ||
          ["_id", "createdAt", "updatedAt"].includes(key)
        )
      ) {
        paths.push(`!path:${key}`)
      }

      if (this.isLogicalOperator(key)) {
        // Logical operators contain arrays of filters
        const filters = value as readonly QueryFilter<T>[]
        for (let i = 0; i < filters.length; i += 1) {
          const subPaths = this.collectValuePaths(
            filters[i] as QueryFilter<T>,
            [...currentPath, String(i)]
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
        paths.push(
          ...this.operatorValuePaths(
            key,
            value as Record<string, unknown>,
            currentPath
          )
        )
      } else if (value !== null) {
        paths.push(JSON.stringify(currentPath))
      }
    }

    return paths
  }

  protected extractValuesFromPaths(
    filter: QueryFilter<T>,
    paths: string[]
  ): SQLiteBindValue[] {
    const values: SQLiteBindValue[] = []

    for (const path of paths) {
      const value = path.startsWith("!path:")
        ? fieldPath(path.slice(6))
        : this.getValueAtPath(filter, path)
      values.push(this.toBindValue(value))
    }

    return values
  }

  protected getValueAtPath(obj: unknown, path: string): unknown {
    const parts = JSON.parse(path) as string[]
    let current: unknown = obj

    for (const part of parts) {
      if (current === null || current === undefined) {
        return
      }

      current = (current as Record<string, unknown>)[part]
    }

    return current
  }

  protected isLogicalOperator(key: string): boolean {
    return key === "$and" || key === "$or" || key === "$nor"
  }

  protected isOperatorObject(value: unknown): boolean {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false
    }
    return Object.keys(value).some((k) => k.startsWith("$"))
  }

  clearCache(): void {
    this.queryCache?.clear()
  }

  get cacheSize(): number {
    return this.queryCache?.size ?? 0
  }

  private operatorValuePaths(
    key: string,
    value: Record<string, unknown>,
    currentPath: string[]
  ): string[] {
    const paths: string[] = []
    if (
      "$exists" in value &&
      !["_id", "createdAt", "updatedAt"].includes(key)
    ) {
      paths.push(`!path:${key}`)
    }
    // Operator object like { $gt: 18, $lt: 65 }
    for (const [op, opValue] of Object.entries(
      value as Record<string, unknown>
    )) {
      if (op === "$exists") {
        // Skip $exists (no value)
        continue
      }
      if ((op === "$eq" || op === "$ne") && opValue === null) {
        continue
      }

      if (Array.isArray(opValue)) {
        paths.push(...this.arrayValuePaths(op, opValue, currentPath))
      } else {
        paths.push(JSON.stringify([...currentPath, op]))
      }
    }
    return paths
  }

  private arrayValuePaths(
    op: string,
    values: readonly unknown[],
    currentPath: readonly string[]
  ): string[] {
    const paths: string[] = []
    for (let i = 0; i < values.length; i += 1) {
      if ((op === "$nin" || op === "$in") && values[i] === null) {
        continue
      }
      paths.push(JSON.stringify([...currentPath, op, String(i)]))
    }
    return paths
  }
}
