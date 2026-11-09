import type { Database as SQLiteDatabase, SQLQueryBindings } from "bun:sqlite"
import stringify from "fast-safe-stringify"
import { throwIfAborted } from "./abort-utils.js"
import {
  CollectionEventEmitter,
  type CollectionEventMap,
  type CollectionEventName,
} from "./collection-events.js"
import type {
  Collection,
  DeleteResult,
  InsertManyResult,
  UpdateResult,
} from "./collection-types.js"
import type { Document } from "./core-types.js"
import { assertDatabaseOpen, isDatabaseClosed } from "./database-state.js"
import { mergeDocumentUpdate } from "./deep-merge.js"
import { buildCompleteDocument } from "./document-builder.js"
import {
  ConnectionError,
  UniqueConstraintError,
  ValidationError,
} from "./errors.js"
import type {
  CursorSpec,
  ProjectionSpec,
  QueryOptions,
  QueryOptionsWithOmit,
  QueryOptionsWithSelect,
  SortSpec,
  TextSearchSpec,
} from "./query-options-types.js"
import type { QueryFilter } from "./query-types.js"
import type { RetryOptions } from "./retry-types.js"
import {
  mergeRetryOptions,
  type RetryableOptions,
  withRetry,
} from "./retry-utils.js"
import type { SchemaDefinition } from "./schema-types.js"
import { SQLiteQueryTranslator } from "./sqlite-query-translator.js"

/** Regex to extract field name from SQLite unique constraint error */
const UNIQUE_CONSTRAINT_REGEX = /UNIQUE constraint failed: \w+\.(\w+)/

/** Regex to remove underscore prefix from generated column names */
const UNDERSCORE_PREFIX_REGEX = /^_/

/**
 * SQLite-based implementation of the Collection interface.
 *
 * @typeParam T - The document type, must extend Document
 *
 * @remarks
 * SQLiteCollection provides a MongoDB-like API backed by SQLite with JSONB storage.
 * It uses generated columns for indexed fields to enable efficient querying while
 * maintaining document flexibility.
 *
 * **Table Structure:**
 * - `_id`: TEXT PRIMARY KEY - Document identifier
 * - `body`: BLOB - JSONB document storage
 * - `createdAt`: INTEGER - Unix timestamp (if in schema)
 * - `updatedAt`: INTEGER - Unix timestamp (if in schema)
 * - Generated columns for indexed fields (e.g., `_age`, `_email`)
 *
 * **Generated Columns:**
 * Indexed fields are extracted from the JSONB `body` column into generated columns
 * for efficient querying. For example:
 * - Field `age` with `indexed: true` creates column `_age GENERATED ALWAYS AS (jsonb_extract(body, '$.age'))`
 * - Indexes are created on these generated columns
 * - Queries use generated columns for WHERE clauses (fast)
 * - Non-indexed fields use jsonb_extract directly (slower)
 *
 * **Performance Benefits:**
 * - Indexed field queries use B-tree indexes (O(log n))
 * - Non-indexed field queries scan JSONB (O(n))
 * - Generated columns have zero storage overhead (VIRTUAL)
 * - Full JSONB flexibility with SQL query performance
 *
 * @example
 * ```typescript
 * import { Database } from 'bun:sqlite';
 * import { SQLiteCollection, createSchema, type Document } from 'stratadb';
 *
 * type User = Document<{
 *   name: string;
 *   email: string;
 *   age: number;
 * }>;
 *
 * const schema = createSchema<User>()
 *   .field('name', { type: 'TEXT', indexed: true })
 *   .field('email', { type: 'TEXT', indexed: true, unique: true })
 *   .field('age', { type: 'INTEGER', indexed: true })
 *   .build();
 *
 * const db = new Database('myapp.db');
 * const users = new SQLiteCollection(db, 'users', schema, () => Bun.randomUUIDv7());
 *
 * // Table is created automatically with:
 * // - _id, body, createdAt, updatedAt columns
 * // - Generated columns: _name, _email, _age
 * // - Indexes on _name, _age
 * // - Unique index on _email
 * ```
 */
export class SQLiteCollection<T extends Document> implements Collection<T> {
  /** Collection name (table name in SQLite) */
  readonly name: string

  /** Schema definition for this collection */
  readonly schema: SchemaDefinition<T>

  /** SQLite database instance */
  private readonly db: SQLiteDatabase

  /** Query translator for converting filters to SQL */
  private readonly translator: SQLiteQueryTranslator<T>

  /** ID generator function for creating document IDs */
  private readonly idGenerator: () => string

  /** Merged retry options for this collection */
  private readonly retryOptions: RetryOptions | undefined

  /** Lazily initialized event emitter for collection events */
  private _emitter: CollectionEventEmitter<T> | null = null

  /**
   * Lazy getter for the event emitter.
   * Creates the emitter only when first accessed.
   */
  private get emitter(): CollectionEventEmitter<T> {
    if (!this._emitter) {
      this._emitter = new CollectionEventEmitter<T>()
    }
    return this._emitter
  }

  /**
   * Optimized event emission helper.
   *
   * @param event - The event name to emit
   * @param createPayload - Factory function that creates the event payload
   *
   * @remarks
   * This method implements performance optimizations:
   * 1. Early return if no emitter exists (no listeners registered)
   * 2. Early return if no listeners for this specific event
   * 3. Deferred payload creation using factory function pattern
   *
   * The factory pattern ensures payload objects are only created when
   * listeners actually exist, avoiding unnecessary object allocation.
   */
  private emitEvent<E extends CollectionEventName>(
    event: E,
    createPayload: () => CollectionEventMap<T>[E][0]
  ): void {
    // Fast path: no emitter means no listeners at all
    if (!this._emitter) {
      return
    }

    // Fast path: no listeners for this specific event
    if (this._emitter.listenerCount(event) === 0) {
      return
    }

    // Only create payload if listeners exist
    const payload = createPayload()
    // @ts-expect-error - EventEmitter's emit typing is complex with tuple types
    this._emitter.emit(event, payload)
  }

  /**
   * Builds retry options for an operation, merging collection and operation-level options.
   */
  private buildRetryOptions(
    operationRetry?: RetryOptions | false,
    signal?: AbortSignal
  ): RetryableOptions | undefined {
    const merged = mergeRetryOptions(this.retryOptions, operationRetry)
    if (!merged) {
      return signal ? { signal } : undefined
    }
    if (signal) {
      return { ...merged, signal }
    }
    return merged
  }

  private runOperation<R>(
    operation: () => Promise<R>,
    options?: RetryableOptions
  ): Promise<R> {
    if (isDatabaseClosed(this.db)) {
      return Promise.reject(new ConnectionError("StrataDB database is closed"))
    }
    return withRetry(() => {
      assertDatabaseOpen(this.db)
      return operation()
    }, options)
  }

  /**
   * Creates a new SQLite collection.
   *
   * @param db - SQLite database instance
   * @param name - Collection name (table name)
   * @param schema - Schema definition for the document type
   * @param idGenerator - Function to generate unique document IDs
   * @param enableCache - Whether to enable query caching (default: false)
   * @param databaseRetryOptions - Database-level retry configuration
   * @param collectionRetryOptions - Collection-level retry configuration
   *
   * @remarks
   * The constructor automatically creates the table and indexes if they don't exist.
   */
  // biome-ignore lint/nursery/useMaxParams: required parameters for collection initialization
  constructor(
    db: SQLiteDatabase,
    name: string,
    schema: SchemaDefinition<T>,
    idGenerator: () => string,
    enableCache = false,
    databaseRetryOptions?: RetryOptions,
    collectionRetryOptions?: RetryOptions | false
  ) {
    assertDatabaseOpen(db)
    this.db = db
    this.name = name
    this.schema = schema
    this.idGenerator = idGenerator
    this.translator = new SQLiteQueryTranslator(schema, { enableCache })
    this.retryOptions = mergeRetryOptions(
      databaseRetryOptions,
      collectionRetryOptions
    )

    // Initialize table and indexes
    this.createTable()
  }

  /**
   * Creates the SQLite table with JSONB storage and generated columns.
   *
   * @remarks
   * Generates and executes SQL statements to create:
   * 1. Main table with _id, body, createdAt, updatedAt columns
   * 2. Generated columns for indexed fields
   * 3. Indexes on generated columns
   * 4. Unique constraints where specified
   *
   * Uses CREATE TABLE IF NOT EXISTS for idempotency.
   *
   * **Generated SQL Example:**
   * ```sql
   * CREATE TABLE IF NOT EXISTS users (
   *   _id TEXT PRIMARY KEY,
   *   body BLOB NOT NULL,
   *   createdAt INTEGER NOT NULL,
   *   updatedAt INTEGER NOT NULL,
   *   _name TEXT GENERATED ALWAYS AS (jsonb_extract(body, '$.name')) VIRTUAL,
   *   _email TEXT GENERATED ALWAYS AS (jsonb_extract(body, '$.email')) VIRTUAL,
   *   _age INTEGER GENERATED ALWAYS AS (jsonb_extract(body, '$.age')) VIRTUAL
   * );
   * CREATE INDEX IF NOT EXISTS idx_users_name ON users(_name);
   * CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(_email);
   * CREATE INDEX IF NOT EXISTS idx_users_age ON users(_age);
   * ```
   *
   * @internal
   */
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: called in constructor
  private createTable(): void {
    const columns: string[] = [
      "_id TEXT PRIMARY KEY",
      "body BLOB NOT NULL",
      "createdAt INTEGER NOT NULL",
      "updatedAt INTEGER NOT NULL",
    ]

    // Add generated columns for indexed fields
    for (const field of this.schema.fields) {
      if (field.indexed) {
        const columnName = `_${String(field.name)}`
        const sqlType = this.mapTypeToSQLite(field.type)
        const path = `$.${String(field.name)}`
        columns.push(
          `${columnName} ${sqlType} GENERATED ALWAYS AS (jsonb_extract(body, '${path}')) VIRTUAL`
        )
      }
    }

    // Create table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.name} (
        ${columns.join(",\n        ")}
      )
    `
    this.db.run(createTableSQL)

    // Create indexes
    this.createIndexes()
  }

  /**
   * Creates indexes on generated columns for indexed fields.
   *
   * @remarks
   * For each indexed field, creates an index on its generated column.
   * Unique fields get UNIQUE indexes, others get regular indexes.
   *
   * Index names follow the pattern: `idx_{table}_{field}`
   *
   * @internal
   */
  private createIndexes(): void {
    for (const field of this.schema.fields) {
      if (field.indexed) {
        const columnName = `_${String(field.name)}`
        const indexName = `idx_${this.name}_${String(field.name)}`
        const uniqueKeyword = field.unique ? "UNIQUE" : ""

        const createIndexSQL = `
          CREATE ${uniqueKeyword} INDEX IF NOT EXISTS ${indexName}
          ON ${this.name}(${columnName})
        `
        this.db.run(createIndexSQL)
      }
    }
  }

  /**
   * Maps schema field types to SQLite column types for generated columns.
   *
   * @param type - Schema field type
   * @returns SQLite column type
   *
   * @remarks
   * Maps StrataDB schema types to actual SQLite column types:
   * - TEXT → TEXT
   * - INTEGER → INTEGER
   * - REAL → REAL
   * - BLOB → BLOB
   * - BOOLEAN → INTEGER (stored as 0/1)
   * - NUMERIC → NUMERIC
   *
   * @internal
   */
  private mapTypeToSQLite(
    type: "TEXT" | "INTEGER" | "REAL" | "BLOB" | "BOOLEAN" | "NUMERIC"
  ): "TEXT" | "INTEGER" | "REAL" | "BLOB" | "NUMERIC" {
    switch (type) {
      case "TEXT":
        return "TEXT"
      case "INTEGER":
        return "INTEGER"
      case "REAL":
        return "REAL"
      case "BLOB":
        return "BLOB"
      case "BOOLEAN":
        return "INTEGER" // SQLite doesn't have BOOLEAN, use INTEGER (0/1)
      case "NUMERIC":
        return "NUMERIC"
      default:
        return "TEXT" // Fallback to TEXT for unknown types
    }
  }

  /**
   * Normalizes filter input to QueryFilter type.
   *
   * @param filter - String ID or QueryFilter object
   * @returns Normalized QueryFilter
   *
   * @internal
   *
   * @remarks
   * Converts string IDs to `{ _id: string }` QueryFilter objects.
   * This helper allows methods to accept either string IDs or full QueryFilter objects
   * while maintaining type safety internally.
   *
   * @example
   * ```typescript
   * // String ID becomes QueryFilter
   * const filter1 = this.normalizeFilter('user-123')
   * // Results in: { _id: 'user-123' }
   *
   * // QueryFilter objects pass through unchanged
   * const filter2 = this.normalizeFilter({ status: 'active' })
   * // Results in: { status: 'active' }
   * ```
   */
  private normalizeFilter(filter: string | QueryFilter<T>): QueryFilter<T> {
    if (typeof filter === "string") {
      return { _id: filter } as QueryFilter<T>
    }
    return filter
  }

  /**
   * Normalizes select/omit options into ProjectionSpec format.
   *
   * @param options - Query options that may contain select, omit, or projection
   * @returns ProjectionSpec or undefined if no projection is needed
   *
   * @remarks
   * Precedence: projection > select > omit.
   * - If projection is set, it's returned directly
   * - If select is set, converts to inclusion projection `{ field: 1 }`
   * - If omit is set, converts to exclusion projection `{ field: 0 }`
   *
   * @internal
   */
  private normalizeProjection(
    options?: QueryOptions<T>
  ): ProjectionSpec<T> | undefined {
    if (!options) {
      return
    }

    // Precedence: projection > select > omit
    if (options.projection) {
      return options.projection
    }

    if (options.select) {
      const projection: Record<string, 1> = {}
      for (const field of options.select) {
        projection[field as string] = 1
      }
      return projection as ProjectionSpec<T>
    }

    if (options.omit) {
      const projection: Record<string, 0> = {}
      for (const field of options.omit) {
        projection[field as string] = 0
      }
      return projection as ProjectionSpec<T>
    }

    return
  }

  /**
   * Builds SQL WHERE clause for text search across multiple fields.
   *
   * @param search - Text search specification
   * @returns Object with SQL clause and parameters, or undefined if no search
   *
   * @remarks
   * Generates OR-connected LIKE clauses for each field.
   * Uses COLLATE NOCASE for case-insensitive matching by default.
   *
   * @internal
   */
  private buildSearchClause(
    search: TextSearchSpec<T>
  ): { sql: string; params: string[] } | undefined {
    if (!search.text || search.fields.length === 0) {
      return
    }

    const pattern = `%${search.text}%`
    const collate = search.caseSensitive ? "" : " COLLATE NOCASE"
    const clauses: string[] = []
    const params: string[] = []

    for (const field of search.fields) {
      const fieldStr = String(field)

      // Check if it's an indexed field (top-level only, no dots)
      const isIndexed =
        !fieldStr.includes(".") &&
        this.schema.fields.some((f) => String(f.name) === fieldStr && f.indexed)

      const column = isIndexed
        ? `_${fieldStr}`
        : `jsonb_extract(body, '$.${fieldStr}')`

      clauses.push(`${column} LIKE ?${collate}`)
      params.push(pattern)
    }

    return {
      sql: `(${clauses.join(" OR ")})`,
      params,
    }
  }

  /**
   * Builds SQL ORDER BY clause from sort specification.
   *
   * @param sort - Sort specification
   * @returns SQL ORDER BY clause or empty string
   *
   * @internal
   */
  private buildSortClause(sort: SortSpec<T>): string {
    const sortClauses: string[] = []
    for (const [field, direction] of Object.entries(sort)) {
      const order = direction === 1 ? "ASC" : "DESC"
      // Use generated column name for indexed fields, otherwise jsonb_extract
      const indexedField = this.schema.fields.find(
        (f) => String(f.name) === field && f.indexed
      )
      const column = indexedField
        ? `_${field}`
        : `jsonb_extract(body, '$.${field}')`
      sortClauses.push(`${column} ${order}`)
    }
    return sortClauses.length > 0 ? ` ORDER BY ${sortClauses.join(", ")}` : ""
  }

  /**
   * Builds SQL WHERE clause for cursor-based pagination.
   *
   * @param cursor - Cursor specification with after/before
   * @param sort - Sort specification (required for cursor pagination)
   * @returns Object with SQL clause and parameters, or undefined if no cursor
   *
   * @remarks
   * Uses the cursor document's sort field value and _id to determine position.
   * For forward pagination (after), gets items where (sortValue, _id) > cursor.
   * For backward pagination (before), gets items where (sortValue, _id) < cursor.
   *
   * @internal
   */
  private buildCursorClause(
    cursor: CursorSpec,
    sort: SortSpec<T>
  ): { sql: string; params: SQLQueryBindings[] } | undefined {
    const cursorId = cursor.after ?? cursor.before
    if (!cursorId) {
      return
    }

    // Get the first sort field and direction
    const sortEntries = Object.entries(sort)
    const firstEntry = sortEntries[0]
    if (!firstEntry) {
      return
    }

    const [sortField, sortDir] = firstEntry
    const isAsc = sortDir === 1
    const isAfter = cursor.after !== undefined

    // Determine comparison operator based on sort direction and cursor type
    // after + asc = > | after + desc = < | before + asc = < | before + desc = >
    const operator = isAfter === isAsc ? ">" : "<"

    // Get column reference for sort field
    const indexedField = this.schema.fields.find(
      (f) => String(f.name) === sortField && f.indexed
    )
    const sortColumn = indexedField
      ? `_${sortField}`
      : `jsonb_extract(body, '$.${sortField}')`

    // Look up the cursor document's sort value
    const cursorQuery = `SELECT ${sortColumn} as sortVal FROM ${this.name} WHERE _id = ?`
    const cursorRow = this.db
      .prepare<{ sortVal: SQLQueryBindings }, [string]>(cursorQuery)
      .get(cursorId)

    if (!cursorRow) {
      return // Cursor document not found, skip cursor filtering
    }

    // Build compound comparison: (sortCol, _id) > (cursorSortVal, cursorId)
    // This ensures stable pagination even with duplicate sort values
    const sql = `((${sortColumn} ${operator} ?) OR (${sortColumn} = ? AND _id ${operator} ?))`
    const params: SQLQueryBindings[] = [
      cursorRow.sortVal,
      cursorRow.sortVal,
      cursorId,
    ]

    return { sql, params }
  }

  /**
   * Applies projection to filter document fields.
   *
   * @param docs - Array of documents to project
   * @param projection - Projection specification (inclusion or exclusion)
   * @returns Projected documents with only the specified fields
   *
   * @remarks
   * - Include mode (values are 1): Keep only _id and specified fields
   * - Exclude mode (values are 0): Remove only specified fields
   * - The _id field is always preserved unless explicitly set to 0
   *
   * @internal
   */
  private applyProjection(
    docs: readonly T[],
    projection: ProjectionSpec<T>
  ): readonly T[] {
    const entries = Object.entries(projection)
    if (entries.length === 0) {
      return docs
    }

    // Detect mode: if any value is 1, it's include mode; otherwise exclude mode
    const isIncludeMode = entries.some(([, value]) => value === 1)

    if (isIncludeMode) {
      return this.applyIncludeProjection(docs, entries, projection)
    }
    return this.applyExcludeProjection(docs, projection)
  }

  /**
   * Applies include-mode projection (keep only specified fields).
   * @internal
   */
  private applyIncludeProjection(
    docs: readonly T[],
    entries: [string, 1 | 0 | undefined][],
    projection: ProjectionSpec<T>
  ): readonly T[] {
    return docs.map((doc) => {
      // Start with _id unless explicitly excluded
      const result: Record<string, unknown> =
        projection._id === 0 ? {} : { _id: doc._id }

      for (const [field, value] of entries) {
        if (value === 1 && field in doc) {
          result[field] = doc[field as keyof T]
        }
      }
      return result as T
    })
  }

  /**
   * Applies exclude-mode projection (remove specified fields).
   * @internal
   */
  private applyExcludeProjection(
    docs: readonly T[],
    projection: ProjectionSpec<T>
  ): readonly T[] {
    return docs.map((doc) => {
      const result: Record<string, unknown> = {}
      for (const key of Object.keys(doc)) {
        const projectionValue = projection[key as keyof T]
        if (projectionValue !== 0) {
          result[key] = doc[key as keyof T]
        }
      }
      return result as T
    })
  }

  // ===== Collection Interface Implementation =====
  // The following methods will be implemented in subsequent tasks

  /**
   * Retrieves a document by its unique identifier.
   *
   * @param id - The document ID to search for
   * @returns Promise resolving to the document if found, or null if not found
   *
   * @throws {DatabaseError} If the SQLite query execution fails
   *
   * @remarks
   * This method uses a prepared statement for efficient ID lookups.
   * The JSONB body is converted to a JavaScript object using SQLite's json() function.
   *
   * @example
   * ```typescript
   * const user = await users.findById('user-123');
   * if (user) {
   *   console.log(user.name);
   * } else {
   *   console.log('User not found');
   * }
   * ```
   */
  findById(
    id: string,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<T | null> {
    return this.runOperation(
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        const stmt = this.db.prepare<{ _id: string; body: string }, [string]>(
          `SELECT _id, json(body) as body FROM ${this.name} WHERE _id = ?`
        )
        const row = stmt.get(id)

        if (!row) {
          return Promise.resolve(null)
        }

        const doc = JSON.parse(row.body) as Omit<T, "_id">
        return Promise.resolve({ _id: row._id, ...doc } as T)
      },
      this.buildRetryOptions(options?.retry, options?.signal)
    )
  }

  /**
   * Finds all documents matching the given filter with optional query options.
   *
   * @param filter - Query filter to match documents
   * @param options - Optional query options (sort, limit, skip)
   * @returns Promise resolving to array of matching documents
   *
   * @throws {QueryError} If query translation fails or contains invalid operators
   * @throws {DatabaseError} If the SQLite query execution fails
   *
   * @remarks
   * Uses the query translator to convert type-safe filters to SQL WHERE clauses.
   * Supports sorting, pagination (limit/skip), and projection.
   *
   * @example
   * ```typescript
   * // Find active users over 18, sorted by name
   * const users = await collection.find(
   *   { status: 'active', age: { $gte: 18 } },
   *   { sort: { name: 1 }, limit: 10 }
   * );
   *
   * // Find with complex filter
   * const results = await collection.find({
   *   $or: [
   *     { role: 'admin' },
   *     { permissions: { $in: ['write', 'delete'] } }
   *   ]
   * });
   * ```
   */
  // Overload 1: With select - returns Pick<T, K | '_id'>
  find<K extends keyof T>(
    filter: QueryFilter<T>,
    options: QueryOptionsWithSelect<T, K>
  ): Promise<readonly Pick<T, K | (keyof T & "_id")>[]>

  // Overload 2: With omit - returns Omit<T, K>
  find<K extends keyof T>(
    filter: QueryFilter<T>,
    options: QueryOptionsWithOmit<T, K>
  ): Promise<readonly Omit<T, K>[]>

  // Overload 3: No projection - returns T
  find(filter: QueryFilter<T>, options?: QueryOptions<T>): Promise<readonly T[]>

  // Implementation
  find(
    filter: QueryFilter<T>,
    options?: QueryOptions<T>
  ): Promise<readonly T[]> {
    return this.runOperation(
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: complex query logic
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        const { sql: whereClause, params } = this.translator.translate(filter)

        let sql = `SELECT _id, json(body) as body FROM ${this.name}`

        // Build WHERE clause combining filter and search
        const whereParts: string[] = []
        const allParams: SQLQueryBindings[] = [...params]

        if (whereClause) {
          whereParts.push(whereClause)
        }

        // Add search clause if provided
        if (options?.search) {
          const searchResult = this.buildSearchClause(options.search)
          if (searchResult) {
            whereParts.push(searchResult.sql)
            allParams.push(...searchResult.params)
          }
        }

        // Add cursor clause if provided (requires sort)
        if (options?.cursor && options?.sort) {
          const cursorResult = this.buildCursorClause(
            options.cursor,
            options.sort
          )
          if (cursorResult) {
            whereParts.push(cursorResult.sql)
            allParams.push(...cursorResult.params)
          }
        }

        if (whereParts.length > 0) {
          sql += ` WHERE ${whereParts.join(" AND ")}`
        }

        // Apply sort
        if (options?.sort) {
          sql += this.buildSortClause(options.sort)
        }

        // Apply limit and skip
        if (options?.limit !== undefined) {
          sql += ` LIMIT ${options.limit}`
        }
        if (options?.skip !== undefined) {
          sql += ` OFFSET ${options.skip}`
        }

        const stmt = this.db.prepare<
          { _id: string; body: string },
          SQLQueryBindings[]
        >(sql)
        const rows = stmt.all(...allParams)

        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        let results = rows.map((row) => {
          const doc = JSON.parse(row.body) as Omit<T, "_id">
          return { _id: row._id, ...doc } as T
        })

        // Apply projection (select/omit/projection)
        const projection = this.normalizeProjection(options)
        if (projection) {
          results = this.applyProjection(results, projection) as T[]
        }

        return Promise.resolve(results)
      },
      this.buildRetryOptions(options?.retry, options?.signal)
    )
  }

  /**
   * Finds the first document matching the given filter.
   *
   * @param filter - Query filter to match documents
   * @param options - Optional query options (sort only, no limit/skip)
   * @returns Promise resolving to the first matching document or null
   *
   * @throws {QueryError} If query translation fails or contains invalid operators
   * @throws {DatabaseError} If the SQLite query execution fails
   *
   * @example
   * ```typescript
   * const admin = await users.findOne({ role: 'admin' });
   * if (admin) {
   *   console.log(`Found admin: ${admin.name}`);
   * }
   * ```
   */
  // Overload 1: With select - returns Pick<T, K | '_id'>
  findOne<K extends keyof T>(
    filter: string | QueryFilter<T>,
    options: Omit<QueryOptionsWithSelect<T, K>, "limit" | "skip">
  ): Promise<Pick<T, K | (keyof T & "_id")> | null>

  // Overload 2: With omit - returns Omit<T, K>
  findOne<K extends keyof T>(
    filter: string | QueryFilter<T>,
    options: Omit<QueryOptionsWithOmit<T, K>, "limit" | "skip">
  ): Promise<Omit<T, K> | null>

  // Overload 3: No projection - returns T
  findOne(
    filter: string | QueryFilter<T>,
    options?: Omit<QueryOptions<T>, "limit" | "skip">
  ): Promise<T | null>

  // Implementation
  async findOne(
    filter: string | QueryFilter<T>,
    options?: Omit<QueryOptions<T>, "limit" | "skip">
  ): Promise<T | null> {
    const normalizedFilter = this.normalizeFilter(filter)
    const results = await this.find(normalizedFilter, { ...options, limit: 1 })
    return results[0] ?? null
  }

  /**
   * Counts documents matching the given filter.
   *
   * @param filter - Query filter to match documents
   * @returns Promise resolving to the count of matching documents
   *
   * @throws {QueryError} If query translation fails or contains invalid operators
   * @throws {DatabaseError} If the SQLite query execution fails
   *
   * @example
   * ```typescript
   * const activeCount = await users.count({ status: 'active' });
   * console.log(`Active users: ${activeCount}`);
   * ```
   */
  count(
    filter: QueryFilter<T>,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<number> {
    return this.runOperation(
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        const { sql: whereClause, params } = this.translator.translate(filter)

        let sql = `SELECT COUNT(*) as count FROM ${this.name}`
        if (whereClause) {
          sql += ` WHERE ${whereClause}`
        }

        const stmt = this.db.prepare<{ count: number }, SQLQueryBindings[]>(sql)
        const row = stmt.get(...params)
        return Promise.resolve(row?.count ?? 0)
      },
      this.buildRetryOptions(options?.retry, options?.signal)
    )
  }

  /**
   * Search for documents across multiple fields.
   *
   * @param text - The search text to find
   * @param fields - Array of field names to search within
   * @param options - Optional query options (filter, sort, limit, projection, etc.)
   * @returns Promise resolving to array of matching documents
   *
   * @example
   * ```typescript
   * // Search for "typescript" in title and content
   * const articles = await posts.search('typescript', ['title', 'content']);
   *
   * // Search with additional filtering
   * const results = await posts.search('react', ['title', 'content'], {
   *   filter: { category: 'programming' },
   *   sort: { createdAt: -1 },
   *   limit: 10
   * });
   * ```
   */
  // Overload 1: With select - returns Pick<T, K | '_id'>
  search<K extends keyof T>(
    text: string,
    fields: readonly (keyof T | string)[],
    options: Omit<QueryOptionsWithSelect<T, K>, "search"> & {
      filter?: QueryFilter<T>
      caseSensitive?: boolean
    }
  ): Promise<readonly Pick<T, K | (keyof T & "_id")>[]>

  // Overload 2: With omit - returns Omit<T, K>
  search<K extends keyof T>(
    text: string,
    fields: readonly (keyof T | string)[],
    options: Omit<QueryOptionsWithOmit<T, K>, "search"> & {
      filter?: QueryFilter<T>
      caseSensitive?: boolean
    }
  ): Promise<readonly Omit<T, K>[]>

  // Overload 3: No projection - returns T
  search(
    text: string,
    fields: readonly (keyof T | string)[],
    options?: Omit<QueryOptions<T>, "search"> & {
      filter?: QueryFilter<T>
      caseSensitive?: boolean
    }
  ): Promise<readonly T[]>

  // Implementation
  search(
    text: string,
    fields: readonly (keyof T | string)[],
    options?: Omit<QueryOptions<T>, "search"> & {
      filter?: QueryFilter<T>
      caseSensitive?: boolean
    }
  ): Promise<readonly T[]> {
    // Delegate to find() with the search option
    const filter = options?.filter ?? ({} as QueryFilter<T>)
    const { filter: _, caseSensitive, ...restOptions } = options ?? {}

    const searchSpec: {
      text: string
      fields: readonly (keyof T | string)[]
    } & {
      caseSensitive?: boolean
    } = { text, fields }

    if (caseSensitive !== undefined) {
      searchSpec.caseSensitive = caseSensitive
    }

    return this.find(filter, {
      ...restOptions,
      search: searchSpec,
    })
  }

  /**
   * Inserts a single document into the collection.
   *
   * @param doc - Document to insert (id is optional, timestamps auto-generated)
   * @returns Promise resolving to the inserted document with generated id
   *
   * @throws UniqueConstraintError if document violates a unique constraint
   * @throws ValidationError if document fails schema validation
   *
   * @example
   * ```typescript
   * // Insert with auto-generated ID
   * const result = await users.insertOne({
   *   name: 'Alice',
   *   email: 'alice@example.com',
   *   age: 30
   * });
   * console.log(result._id); // Auto-generated ID
   *
   * // Insert with custom ID
   * const result2 = await users.insertOne({
   *   _id: 'custom-id',
   *   name: 'Bob',
   *   email: 'bob@example.com',
   *   age: 25
   * });
   * ```
   */
  insertOne(
    doc: Omit<T, "_id" | "createdAt" | "updatedAt"> & { _id?: string },
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<T> {
    return this.runOperation(
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: complex insert logic
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        const now = Date.now()
        const _id = doc._id ?? this.idGenerator()

        // Build the full document
        const fullDoc = buildCompleteDocument<T>(doc, {
          _id,
          createdAt: now,
          updatedAt: now,
        })

        // Validate using schema validator if provided
        if (this.schema.validate && !this.schema.validate(fullDoc)) {
          throw new ValidationError(
            "Document validation failed: Document does not match the schema. " +
              "Check that all required fields are present and have correct types.",
            undefined,
            fullDoc
          )
        }

        // Serialize body (excludes id which is stored separately)
        const { _id: docId, ...bodyData } = fullDoc
        const body = stringify(bodyData)

        try {
          const stmt = this.db.prepare(
            `INSERT INTO ${this.name} (_id, body, createdAt, updatedAt) VALUES (?, jsonb(?), ?, ?)`
          )
          stmt.run(docId, body, now, now)

          // Emit insert event after successful operation
          this.emitEvent("insert", () => ({ document: fullDoc }))

          return Promise.resolve(fullDoc)
        } catch (error) {
          // Handle unique constraint violations
          if (
            error instanceof Error &&
            error.message.includes("UNIQUE constraint failed")
          ) {
            // Extract field name from error message
            const match = error.message.match(UNIQUE_CONSTRAINT_REGEX)
            const field = match?.[1]?.replace(UNDERSCORE_PREFIX_REGEX, "") // Remove underscore prefix from generated columns

            // Get the value that violated the constraint
            const value = field
              ? (fullDoc as Record<string, unknown>)[field]
              : undefined

            // Use helper to build actionable error message
            const message = field
              ? `Duplicate value for unique field '${field}': ${JSON.stringify(value)} in collection '${this.name}'. ` +
                "A document with this value already exists. " +
                "Use updateOne() with { upsert: true } to update existing documents, " +
                "or use findOne() to check for existence before inserting."
              : "Unique constraint violation occurred"

            throw new UniqueConstraintError(message, field, value)
          }
          throw error
        }
      },
      this.buildRetryOptions(options?.retry, options?.signal)
    )
  }

  /**
   * Updates a single document by ID with partial update support.
   *
   * @param id - Document ID to update
   * @param update - Partial document with fields to update
   * @param options - Update options (upsert: create if not exists)
   * @returns Promise resolving to updated document or null if not found
   *
   * @throws {ValidationError} If the updated document fails schema validation
   * @throws {DatabaseError} If the SQLite update operation fails
   *
   * @example
   * ```typescript
   * // Partial update
   * const updated = await users.updateOne('user-123', { age: 31 });
   *
   * // Upsert - creates if not found
   * const result = await users.updateOne(
   *   'new-user',
   *   { name: 'New User', email: 'new@example.com' },
   *   { upsert: true }
   * );
   * ```
   */
  async updateOne(
    filter: string | QueryFilter<T>,
    update: Omit<Partial<T>, "_id" | "createdAt" | "updatedAt">,
    options?: { upsert?: boolean; signal?: AbortSignal }
  ): Promise<T | null> {
    assertDatabaseOpen(this.db)
    throwIfAborted(options?.signal)

    const normalizedFilter = this.normalizeFilter(filter)
    const existing = await this.findOne(
      normalizedFilter,
      options?.signal ? { signal: options.signal } : undefined
    )

    assertDatabaseOpen(this.db)
    throwIfAborted(options?.signal)

    if (!existing) {
      if (options?.upsert) {
        // Merge filter fields into document for upsert
        const filterFields =
          typeof filter === "string" ? { _id: filter } : filter
        const signalOpt = options?.signal
          ? { signal: options.signal }
          : undefined
        const upsertDoc = { ...filterFields, ...update } as Omit<
          T,
          "_id" | "createdAt" | "updatedAt"
        >
        const inserted = await this.insertOne(upsertDoc, signalOpt)

        // Emit update event with upserted flag
        this.emitEvent("update", () => ({
          filter,
          update: update as Partial<T>,
          document: inserted,
          upserted: true,
        }))

        return inserted
      }
      return null
    }

    // Document exists - update it
    const now = Date.now()
    const mergedDoc = mergeDocumentUpdate<
      T,
      typeof update & { _id: string; updatedAt: number }
    >(existing, {
      ...update,
      _id: existing._id,
      updatedAt: now,
    })

    if (this.schema.validate && !this.schema.validate(mergedDoc)) {
      throw new ValidationError(
        "Document validation failed after merge: Document does not match the schema. " +
          "Check that all required fields are present and have correct types.",
        undefined,
        mergedDoc
      )
    }

    const { _id: mergedDocId, ...mergedBodyData } = mergedDoc
    const mergedBody = stringify(mergedBodyData)
    this.db
      .prepare(
        `UPDATE ${this.name} SET body = jsonb(?), updatedAt = ? WHERE _id = ?`
      )
      .run(mergedBody, now, mergedDocId)

    // Emit update event after successful operation
    this.emitEvent("update", () => ({
      filter,
      update: update as Partial<T>,
      document: mergedDoc,
      upserted: false,
    }))

    return mergedDoc
  }

  /**
   * Replaces an entire document by ID or filter (no merge, complete replacement).
   *
   * @param filter - Document ID (string) or query filter
   * @param doc - Complete new document (_id, createdAt, updatedAt excluded via type)
   * @returns Promise resolving to replaced document or null if not found
   *
   * @throws {ValidationError} If the replacement document fails schema validation
   * @throws {DatabaseError} If the SQLite update operation fails
   *
   * @remarks
   * Unlike updateOne which merges fields, replaceOne completely replaces
   * the document body while preserving the original _id and createdAt timestamp.
   *
   * @example
   * ```typescript
   * // Replace by ID
   * const replaced = await users.replaceOne('user-123', {
   *   name: 'Alice Smith',
   *   email: 'alice.new@example.com',
   *   age: 31
   * });
   *
   * // Replace by filter
   * const replaced = await users.replaceOne(
   *   { email: 'old@example.com' },
   *   {
   *     name: 'Alice Smith',
   *     email: 'new@example.com',
   *     age: 31
   *   }
   * );
   *
   * // Difference from updateOne:
   * // - updateOne({ age: 31 }) -> merges age into existing doc
   * // - replaceOne({ age: 31 }) -> doc now ONLY has age field
   * ```
   */
  replaceOne(
    filter: string | QueryFilter<T>,
    doc: Omit<T, "_id" | "createdAt" | "updatedAt">,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<T | null> {
    return this.runOperation(
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        const normalizedFilter = this.normalizeFilter(filter)

        // Find the document ID to replace
        const { sql: whereClause, params } =
          this.translator.translate(normalizedFilter)
        let querySql = `SELECT _id, json_extract(body, '$.createdAt') as createdAt FROM ${this.name}`
        if (whereClause && whereClause !== "1=1") {
          querySql += ` WHERE ${whereClause}`
        }
        querySql += " LIMIT 1"

        const row = this.db
          .prepare<{ _id: string; createdAt: number }, SQLQueryBindings[]>(
            querySql
          )
          .get(...params)

        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        if (!row) {
          // Emit replace event with null document
          this.emitEvent("replace", () => ({
            filter,
            document: null,
          }))

          return Promise.resolve(null)
        }

        const now = Date.now()

        // Build full document with preserved _id and createdAt
        const fullDoc = buildCompleteDocument<T>(doc, {
          _id: row._id,
          createdAt: row.createdAt,
          updatedAt: now,
        })

        if (this.schema.validate && !this.schema.validate(fullDoc)) {
          throw new ValidationError(
            `Document validation failed during replace for filter '${JSON.stringify(filter)}': Document does not match the schema. ` +
              "Check that all required fields are present and have correct types.",
            undefined,
            fullDoc
          )
        }

        const { _id: replaceDocId, ...bodyData } = fullDoc
        const body = stringify(bodyData)
        this.db
          .prepare(
            `UPDATE ${this.name} SET body = jsonb(?), updatedAt = ? WHERE _id = ?`
          )
          .run(body, now, replaceDocId)

        // Emit replace event after successful operation
        this.emitEvent("replace", () => ({
          filter,
          document: fullDoc,
        }))

        return Promise.resolve(fullDoc)
      },
      this.buildRetryOptions(options?.retry, options?.signal)
    )
  }

  /**
   * Deletes a single document by ID or filter.
   *
   * @param filter - Document ID (string) or query filter
   * @returns Promise resolving to true if deleted, false if not found
   *
   * @throws {DatabaseError} If the SQLite delete operation fails
   *
   * @example
   * ```typescript
   * // Delete by ID
   * const deleted = await users.deleteOne('user-123');
   * if (deleted) {
   *   console.log('User deleted');
   * }
   *
   * // Delete by filter
   * const deleted = await users.deleteOne({ status: 'inactive' });
   * ```
   */
  deleteOne(
    filter: string | QueryFilter<T>,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<boolean> {
    return this.runOperation(
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        const normalizedFilter = this.normalizeFilter(filter)

        // Optimization: If filter is just { _id: 'xxx' }, use direct delete
        if (
          "_id" in normalizedFilter &&
          Object.keys(normalizedFilter).length === 1
        ) {
          const stmt = this.db.prepare(`DELETE FROM ${this.name} WHERE _id = ?`)
          const result = stmt.run(normalizedFilter._id as string)
          const deleted = result.changes > 0

          // Emit delete event after successful operation
          this.emitEvent("delete", () => ({
            filter,
            deleted,
          }))

          return Promise.resolve(deleted)
        }

        // For complex filters: find first match, then delete by ID
        const { sql: whereClause, params } =
          this.translator.translate(normalizedFilter)
        let findSql = `SELECT _id FROM ${this.name}`
        if (whereClause && whereClause !== "1=1") {
          findSql += ` WHERE ${whereClause}`
        }
        findSql += " LIMIT 1"

        const row = this.db
          .prepare<{ _id: string }, SQLQueryBindings[]>(findSql)
          .get(...params)
        if (!row) {
          return Promise.resolve(false)
        }

        const stmt = this.db.prepare(`DELETE FROM ${this.name} WHERE _id = ?`)
        const result = stmt.run(row._id)
        const deleted = result.changes > 0

        // Emit delete event after successful operation
        this.emitEvent("delete", () => ({
          filter,
          deleted,
        }))

        return Promise.resolve(deleted)
      },
      this.buildRetryOptions(options?.retry, options?.signal)
    )
  }

  /**
   * Handles insertion errors and pushes to errors array.
   * @internal
   */
  private handleInsertError(
    error: unknown,
    index: number,
    doc: Omit<T, "_id" | "createdAt" | "updatedAt"> & { _id?: string },
    errors: { index: number; error: Error; document: typeof doc }[]
  ): Error {
    const err = error instanceof Error ? error : new Error(String(error))

    if (err.message.includes("UNIQUE constraint failed")) {
      const match = err.message.match(UNIQUE_CONSTRAINT_REGEX)
      const field = match?.[1]?.replace(UNDERSCORE_PREFIX_REGEX, "")
      const uniqueErr = new UniqueConstraintError(
        `Duplicate value for unique field '${field}'`,
        field,
        undefined
      )
      errors.push({ index, error: uniqueErr, document: doc })
      return uniqueErr
    }

    errors.push({ index, error: err, document: doc })
    return err
  }

  /**
   * Inserts multiple documents into the collection.
   *
   * @param docs - Array of documents to insert
   * @param options - Insertion options (ordered: stop on first error if true)
   * @returns Promise resolving to bulk write result with success/failure details
   *
   * @throws {ValidationError} If any document fails schema validation
   * @throws {UniqueConstraintError} If any document violates a unique constraint
   * @throws {DatabaseError} If the SQLite insert operation fails
   *
   * @example
   * ```typescript
   * // Ordered insertion (default) - stops on first error
   * const result = await users.insertMany([
   *   { name: 'Alice', email: 'alice@example.com' },
   *   { name: 'Bob', email: 'bob@example.com' }
   * ]);
   *
   * // Unordered - continues despite errors
   * const result2 = await users.insertMany(
   *   [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
   *   { ordered: false }
   * );
   * console.log(`Inserted: ${result2.insertedCount}, Errors: ${result2.errors.length}`);
   * ```
   */
  insertMany(
    docs: readonly (Omit<T, "_id" | "createdAt" | "updatedAt"> & {
      _id?: string
    })[],
    options?: {
      ordered?: boolean
      signal?: AbortSignal
      retry?: RetryOptions | false
    }
  ): Promise<InsertManyResult<T>> {
    return this.runOperation(
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: complex batch insert logic
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        const ordered = options?.ordered ?? true
        const now = Date.now()
        const insertedDocs: T[] = []
        const insertedIds: string[] = []
        const errors: {
          index: number
          error: Error
          document: Omit<T, "_id" | "createdAt" | "updatedAt"> & {
            _id?: string
          }
        }[] = []

        const stmt = this.db.prepare(
          `INSERT INTO ${this.name} (_id, body, createdAt, updatedAt) VALUES (?, jsonb(?), ?, ?)`
        )

        for (let i = 0; i < docs.length; i++) {
          assertDatabaseOpen(this.db)
          throwIfAborted(options?.signal)

          const doc = docs[i]
          if (!doc) {
            continue
          }

          try {
            const _id = doc._id ?? this.idGenerator()
            const fullDoc = buildCompleteDocument<T>(doc, {
              _id,
              createdAt: now,
              updatedAt: now,
            })

            // Validate if validator is provided
            if (this.schema.validate && !this.schema.validate(fullDoc)) {
              throw new ValidationError(
                `Document validation failed in batch insert at index ${i}: Document does not match the schema. ` +
                  "Check that all required fields are present and have correct types.",
                undefined,
                fullDoc
              )
            }

            const { _id: docId, ...bodyData } = fullDoc
            const body = stringify(bodyData)
            stmt.run(docId, body, now, now)

            insertedDocs.push(fullDoc)
            insertedIds.push(_id)
          } catch (error) {
            const err = this.handleInsertError(error, i, doc, errors)
            if (ordered && err) {
              break
            }
          }
        }

        // Emit insertMany event after successful operation
        this.emitEvent("insertMany", () => ({
          documents: insertedDocs,
          insertedCount: insertedDocs.length,
        }))

        return Promise.resolve({
          documents: insertedDocs,
          insertedCount: insertedDocs.length,
        })
      },
      this.buildRetryOptions(options?.retry, options?.signal)
    )
  }

  /**
   * Updates all documents matching the filter with a partial update.
   *
   * @param filter - Query filter to find documents to update
   * @param update - Partial document with fields to update
   * @returns Promise resolving to update result with modifiedCount
   *
   * @throws {ValidationError} If any updated document fails schema validation
   * @throws {QueryError} If query translation fails or contains invalid operators
   * @throws {DatabaseError} If the SQLite update operation fails
   *
   * @remarks
   * Uses a transaction to ensure all-or-nothing semantics. All matching documents
   * are retrieved, merged with the update, validated, and then persisted atomically.
   *
   * @example
   * ```typescript
   * // Set all inactive users to deleted status
   * const result = await users.updateMany(
   *   { status: 'inactive' },
   *   { status: 'deleted' }
   * );
   * console.log(`Updated ${result.modifiedCount} users`);
   *
   * // Give all admins a badge
   * await users.updateMany(
   *   { role: 'admin' },
   *   { badge: 'admin' }
   * );
   * ```
   */
  updateMany(
    filter: QueryFilter<T>,
    update: Omit<Partial<T>, "_id" | "createdAt" | "updatedAt">,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<UpdateResult> {
    return this.runOperation(
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        const { sql: whereClause, params } = this.translator.translate(filter)

        // Find all matching documents
        let selectSql = `SELECT _id, json(body) as body FROM ${this.name}`
        if (whereClause) {
          selectSql += ` WHERE ${whereClause}`
        }

        const stmt = this.db.prepare<
          { _id: string; body: string },
          SQLQueryBindings[]
        >(selectSql)
        const rows = stmt.all(...params)
        const matchedCount = rows.length

        if (matchedCount === 0) {
          // Emit updateMany event even when no matches
          this.emitEvent("updateMany", () => ({
            filter,
            update: update as Partial<T>,
            matchedCount: 0,
            modifiedCount: 0,
          }))

          return Promise.resolve({
            matchedCount: 0,
            modifiedCount: 0,
          })
        }

        const now = Date.now()
        const updatedDocs: T[] = []

        // Prepare all updated documents and validate before committing
        for (const row of rows) {
          assertDatabaseOpen(this.db)
          throwIfAborted(options?.signal)

          const existingDoc = JSON.parse(row.body) as Omit<T, "_id">
          const mergedDoc = mergeDocumentUpdate<
            T,
            typeof update & { _id: string; updatedAt: number }
          >(existingDoc, {
            ...update,
            _id: row._id,
            updatedAt: now,
          })

          if (this.schema.validate && !this.schema.validate(mergedDoc)) {
            throw new ValidationError(
              `Document validation failed during batch update for id '${row._id}': Document does not match the schema. ` +
                "Check that all required fields are present and have correct types.",
              undefined,
              mergedDoc
            )
          }

          updatedDocs.push(mergedDoc)
        }

        // Use transaction for atomic update
        const updateStmt = this.db.prepare(
          `UPDATE ${this.name} SET body = jsonb(?), updatedAt = ? WHERE _id = ?`
        )

        this.db.exec("BEGIN TRANSACTION")
        try {
          for (const doc of updatedDocs) {
            const { _id, ...bodyData } = doc
            const body = stringify(bodyData)
            updateStmt.run(body, now, _id)
          }
          this.db.exec("COMMIT")
        } catch (error) {
          this.db.exec("ROLLBACK")
          throw error
        }

        // Emit updateMany event after successful operation
        this.emitEvent("updateMany", () => ({
          filter,
          update: update as Partial<T>,
          matchedCount,
          modifiedCount: updatedDocs.length,
        }))

        return Promise.resolve({
          matchedCount,
          modifiedCount: updatedDocs.length,
        })
      },
      this.buildRetryOptions(options?.retry, options?.signal)
    )
  }

  /**
   * Deletes all documents matching the filter.
   *
   * @param filter - Query filter to match documents to delete
   * @returns Promise resolving to delete result with deletedCount
   *
   * @throws {QueryError} If query translation fails or contains invalid operators
   * @throws {DatabaseError} If the SQLite delete operation fails
   *
   * @remarks
   * Uses a transaction to ensure atomic deletion of all matching documents.
   *
   * @example
   * ```typescript
   * // Delete all inactive users
   * const result = await users.deleteMany({ status: 'inactive' });
   * console.log(`Deleted ${result.deletedCount} users`);
   *
   * // Delete all documents (use with caution!)
   * await users.deleteMany({});
   * ```
   */
  deleteMany(
    filter: QueryFilter<T>,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<DeleteResult> {
    return this.runOperation(
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        const { sql: whereClause, params } = this.translator.translate(filter)

        let sql = `DELETE FROM ${this.name}`
        if (whereClause) {
          sql += ` WHERE ${whereClause}`
        }

        this.db.exec("BEGIN TRANSACTION")
        try {
          const stmt = this.db.prepare(sql)
          const result = stmt.run(...params)
          this.db.exec("COMMIT")

          const deletedCount = result.changes

          // Emit deleteMany event after successful operation
          this.emitEvent("deleteMany", () => ({
            filter,
            deletedCount,
          }))

          return Promise.resolve({
            deletedCount,
          })
        } catch (error) {
          this.db.exec("ROLLBACK")
          throw error
        }
      },
      this.buildRetryOptions(options?.retry, options?.signal)
    )
  }

  // ===== Atomic Find-and-Modify Operations =====

  /**
   * Find and delete a single document atomically.
   *
   * @param filter - Document ID (string) or query filter
   * @param options - Query options (sort)
   * @returns Promise resolving to the deleted document, or null if not found
   *
   * @remarks
   * This operation is atomic - it finds and deletes in a single operation.
   * Useful when you need the deleted document's data (e.g., for logging, undo operations).
   *
   * @example
   * ```typescript
   * // Delete by ID
   * const deleted = await users.findOneAndDelete('user-123');
   * if (deleted) {
   *   console.log(`Deleted user: ${deleted.name}`);
   * }
   *
   * // Delete by filter with sort
   * const deleted = await users.findOneAndDelete(
   *   { status: 'inactive' },
   *   { sort: { createdAt: 1 } }
   * );
   * ```
   */
  // biome-ignore lint/suspicious/useAwait: wrapper for retry logic
  async findOneAndDelete(
    filter: string | QueryFilter<T>,
    options?: {
      sort?: SortSpec<T>
      signal?: AbortSignal
      retry?: RetryOptions | false
    }
  ): Promise<T | null> {
    return this.runOperation(
      async () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        // Normalize and find the document first
        const normalizedFilter = this.normalizeFilter(filter)
        const doc = await this.findOne(normalizedFilter, options)

        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        if (!doc) {
          // Emit findOneAndDelete event with null document
          this.emitEvent("findOneAndDelete", () => ({
            filter,
            document: null,
          }))

          return null
        }

        // Delete by ID
        const stmt = this.db.prepare(`DELETE FROM ${this.name} WHERE _id = ?`)
        stmt.run(doc._id)

        // Emit findOneAndDelete event after successful operation
        this.emitEvent("findOneAndDelete", () => ({
          filter,
          document: doc,
        }))

        return doc
      },
      this.buildRetryOptions(options?.retry, options?.signal)
    )
  }

  /**
   * Find and update a single document atomically.
   *
   * @param filter - Document ID (string) or query filter
   * @param update - Partial document with fields to update
   * @param options - Update options (sort, returnDocument, upsert)
   * @returns Promise resolving to the document before or after update, or null if not found
   */
  // biome-ignore lint/suspicious/useAwait: wrapper for retry logic
  async findOneAndUpdate(
    filter: string | QueryFilter<T>,
    update: Omit<Partial<T>, "_id" | "createdAt" | "updatedAt">,
    options?: {
      sort?: SortSpec<T>
      returnDocument?: "before" | "after"
      upsert?: boolean
      signal?: AbortSignal
      retry?: RetryOptions | false
    }
  ): Promise<T | null> {
    return this.runOperation(
      async () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        const returnDoc = options?.returnDocument ?? "after"
        const normalizedFilter = this.normalizeFilter(filter)

        // Find the document
        const findOptions = options?.sort ? { sort: options.sort } : undefined
        const existing = await this.findOne(normalizedFilter, findOptions)

        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        if (!existing) {
          // Handle upsert
          if (options?.upsert) {
            const inserted = await this.insertOne(
              update as Omit<T, "_id" | "createdAt" | "updatedAt">
            )
            const resultDoc = returnDoc === "after" ? inserted : null

            // Emit findOneAndUpdate event with upserted flag
            this.emitEvent("findOneAndUpdate", () => ({
              filter,
              update: update as Partial<T>,
              document: resultDoc,
              upserted: true,
            }))

            return resultDoc
          }

          // Emit findOneAndUpdate event with null document
          this.emitEvent("findOneAndUpdate", () => ({
            filter,
            update: update as Partial<T>,
            document: null,
            upserted: false,
          }))

          return null
        }

        // Update by _id
        const before = existing
        const afterUpdate = await this.updateOne(existing._id, update)
        const resultDoc = returnDoc === "before" ? before : afterUpdate

        // Emit findOneAndUpdate event after successful operation
        this.emitEvent("findOneAndUpdate", () => ({
          filter,
          update: update as Partial<T>,
          document: resultDoc,
          upserted: false,
        }))

        return resultDoc
      },
      this.buildRetryOptions(options?.retry, options?.signal)
    )
  }

  /**
   * Find and replace a single document atomically.
   *
   * @param filter - Document ID (string) or query filter
   * @param replacement - Complete replacement document
   * @param options - Replace options (sort, returnDocument, upsert)
   * @returns Promise resolving to the document before or after replacement, or null if not found
   */
  // biome-ignore lint/suspicious/useAwait: wrapper for retry logic
  async findOneAndReplace(
    filter: string | QueryFilter<T>,
    replacement: Omit<T, "_id" | "createdAt" | "updatedAt">,
    options?: {
      sort?: SortSpec<T>
      returnDocument?: "before" | "after"
      upsert?: boolean
      signal?: AbortSignal
      retry?: RetryOptions | false
    }
  ): Promise<T | null> {
    return this.runOperation(
      async () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        const returnDoc = options?.returnDocument ?? "after"
        const normalizedFilter = this.normalizeFilter(filter)

        // Find the document
        const findOptions = options?.sort ? { sort: options.sort } : undefined
        const existing = await this.findOne(normalizedFilter, findOptions)

        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        if (!existing) {
          // Handle upsert
          if (options?.upsert) {
            const inserted = await this.insertOne(replacement)
            const resultDoc = returnDoc === "after" ? inserted : null

            // Emit findOneAndReplace event with upserted flag
            this.emitEvent("findOneAndReplace", () => ({
              filter,
              document: resultDoc,
              upserted: true,
            }))

            return resultDoc
          }

          // Emit findOneAndReplace event with null document
          this.emitEvent("findOneAndReplace", () => ({
            filter,
            document: null,
            upserted: false,
          }))

          return null
        }

        // Replace by _id
        const before = existing
        const afterReplace = await this.replaceOne(existing._id, replacement)
        const resultDoc = returnDoc === "before" ? before : afterReplace

        // Emit findOneAndReplace event after successful operation
        this.emitEvent("findOneAndReplace", () => ({
          filter,
          document: resultDoc,
          upserted: false,
        }))

        return resultDoc
      },
      this.buildRetryOptions(options?.retry, options?.signal)
    )
  }

  // ===== Utility Methods =====

  /**
   * Find distinct values for a specified field across the collection.
   *
   * @param field - The field name to get distinct values for
   * @param filter - Optional query filter to narrow results
   * @returns Promise resolving to array of unique values for the field
   */
  distinct<K extends keyof Omit<T, "_id" | "createdAt" | "updatedAt">>(
    field: K,
    filter?: QueryFilter<T>,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<T[K][]> {
    return this.runOperation(
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        const fieldStr = String(field)

        // Determine if field is indexed
        const indexedField = this.schema.fields.find(
          (f) => String(f.name) === fieldStr && f.indexed
        )
        const column = indexedField
          ? `_${fieldStr}`
          : `jsonb_extract(body, '$.${fieldStr}')`

        // Build query
        let sql = `SELECT DISTINCT ${column} as value FROM ${this.name}`
        let params: SQLQueryBindings[] = []

        if (filter) {
          const { sql: whereClause, params: filterParams } =
            this.translator.translate(filter)
          if (whereClause) {
            sql += ` WHERE ${whereClause}`
            params = filterParams
          }
        }

        sql += " ORDER BY value"

        const stmt = this.db.prepare<{ value: T[K] }, SQLQueryBindings[]>(sql)
        const rows = stmt.all(...params)

        return Promise.resolve(rows.map((row) => row.value))
      },
      this.buildRetryOptions(options?.retry, options?.signal)
    )
  }

  /**
   * Get an estimated count of documents in the collection.
   *
   * @returns Promise resolving to the estimated document count
   */
  estimatedDocumentCount(options?: {
    signal?: AbortSignal
    retry?: RetryOptions | false
  }): Promise<number> {
    return this.runOperation(
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        // Use SQLite's internal statistics for fast estimate
        const stmt = this.db.prepare<{ count: number }, []>(
          `SELECT COUNT(*) as count FROM ${this.name}`
        )
        const result = stmt.get()
        return Promise.resolve(result?.count ?? 0)
      },
      this.buildRetryOptions(options?.retry, options?.signal)
    )
  }

  /**
   * Drop the collection (delete the table).
   *
   * @returns Promise resolving when the collection is dropped
   */
  drop(options?: {
    signal?: AbortSignal
    retry?: RetryOptions | false
  }): Promise<void> {
    return this.runOperation(
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)
        this.db.exec(`DROP TABLE IF EXISTS ${this.name}`)

        // Emit drop event after successful operation
        this.emitEvent("drop", () => ({
          name: this.name,
        }))

        // Clean up event resources after emitting drop event
        this.cleanupEvents()

        return Promise.resolve()
      },
      this.buildRetryOptions(options?.retry, options?.signal)
    )
  }

  /**
   * Cleans up event emitter resources.
   * Called internally when collection is dropped or database is closed.
   * @internal
   */
  cleanupEvents(): void {
    if (this._emitter) {
      this._emitter.removeAllListeners()
      this._emitter = null
    }
  }

  /**
   * Validates a document against the schema asynchronously.
   *
   * @param doc - Document to validate
   * @returns Promise resolving to the validated document typed as T
   *
   * @throws {ValidationError} If the document fails schema validation
   *
   * @example
   * ```typescript
   * try {
   *   const user = await users.validate(unknownData);
   *   console.log('Valid user:', user.name);
   * } catch (err) {
   *   if (err instanceof ValidationError) {
   *     console.error(`Field ${err.field} failed:`, err.message);
   *   }
   * }
   * ```
   */
  validate(
    doc: unknown,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<T> {
    return this.runOperation(
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        if (!this.schema.validate) {
          // No validator configured, trust the document
          return Promise.resolve(doc as T)
        }

        if (this.schema.validate(doc)) {
          return Promise.resolve(doc as T)
        }

        throw new ValidationError("Document validation failed", undefined, doc)
      },
      this.buildRetryOptions(options?.retry, options?.signal)
    )
  }

  /**
   * Validates a document against the schema synchronously.
   *
   * @param doc - Document to validate
   * @returns The validated document typed as T
   *
   * @throws {ValidationError} If the document fails schema validation
   *
   * @example
   * ```typescript
   * try {
   *   const user = users.validateSync(unknownData);
   *   console.log('Valid user:', user.name);
   * } catch (err) {
   *   if (err instanceof ValidationError) {
   *     console.error(`Field ${err.field} failed:`, err.message);
   *   }
   * }
   * ```
   */
  validateSync(doc: unknown): T {
    assertDatabaseOpen(this.db)
    if (!this.schema.validate) {
      // No validator configured, trust the document
      return doc as T
    }

    if (this.schema.validate(doc)) {
      return doc as T
    }

    throw new ValidationError("Document validation failed", undefined, doc)
  }

  // ===== Event Methods (stub implementations - to be completed in task-190-191) =====

  on<E extends CollectionEventName>(
    event: E,
    listener: (...args: CollectionEventMap<T>[E]) => void
  ): Collection<T> {
    // @ts-expect-error - EventEmitter's generic typing is complex with tuple types
    this.emitter.on(event, listener)
    return this
  }

  once<E extends CollectionEventName>(
    event: E,
    listener: (...args: CollectionEventMap<T>[E]) => void
  ): Collection<T> {
    // @ts-expect-error - EventEmitter's generic typing is complex with tuple types
    this.emitter.once(event, listener)
    return this
  }

  off<E extends CollectionEventName>(
    event: E,
    listener: (...args: CollectionEventMap<T>[E]) => void
  ): Collection<T> {
    if (this._emitter) {
      // @ts-expect-error - EventEmitter's generic typing is complex with tuple types
      this._emitter.off(event, listener)
    }
    return this
  }

  removeAllListeners(event?: CollectionEventName): Collection<T> {
    if (this._emitter) {
      if (event === undefined) {
        this._emitter.removeAllListeners()
      } else {
        this._emitter.removeAllListeners(event)
      }
    }
    return this
  }

  listenerCount(event: CollectionEventName): number {
    if (!this._emitter) {
      return 0
    }
    return this._emitter.listenerCount(event)
  }

  listeners<E extends CollectionEventName>(
    event: E
  ): ((...args: CollectionEventMap<T>[E]) => void)[] {
    if (!this._emitter) {
      return []
    }
    // Every public event name belongs to CollectionEventMap; Node 26 also
    // permits built-in emitter events in its conditional listener type.
    return this._emitter.listeners(event) as ((
      ...args: CollectionEventMap<T>[E]
    ) => void)[]
  }
}
