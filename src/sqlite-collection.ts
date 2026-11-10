import type { Database as SQLiteDatabase, SQLQueryBindings } from "bun:sqlite"
import stringify from "fast-safe-stringify"
import { throwIfAborted } from "./abort-utils.js"
import {
  type AtomicPlan,
  applyAtomicUpdate,
  compileAtomicBody,
  parseAtomicUpdate,
  seedEqualities,
} from "./atomic-updates.js"
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
import type { Document, DocumentUpdate } from "./core-types.js"
import {
  buildCursorPredicate,
  cursorOrder,
  reverseSort,
} from "./cursor-pagination.js"
import {
  assertDatabaseOpen,
  assertOperationAllowed,
  isDatabaseClosed,
  isDatabaseReadonly,
} from "./database-state.js"
import { mergeDocumentUpdate } from "./deep-merge.js"
import { buildCompleteDocument } from "./document-builder.js"
import {
  ConnectionError,
  SchemaValidationError,
  UniqueConstraintError,
  ValidationError,
} from "./errors.js"
import {
  bind,
  compoundIndexName,
  ddlField,
  fieldPath,
  generatedColumn,
  positional,
  quoteIdent,
  resolveDDLField,
  resolveField,
} from "./field-resolver.js"
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
import { evolveGeneratedColumns } from "./schema-evolution.js"
import type { SchemaDefinition } from "./schema-types.js"
import {
  SQLiteBoundary,
  sqliteCall,
  sqliteOperation,
  wrapSqliteError,
} from "./sqlite-boundary.js"
import { SQLiteQueryTranslator } from "./sqlite-query-translator.js"
import { escapeLikeLiteral } from "./string-patterns.js"
import { transactionManager } from "./transaction-manager.js"

type StoredRow = {
  _id: string
  body: string
  createdAt: number
  updatedAt: number
}
type MutationResult<T> = {
  before: T | null
  after: T | null
  upserted: boolean
}

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

  private get tableSql(): string {
    return quoteIdent(this.name)
  }

  /** Schema definition for this collection */
  readonly schema: SchemaDefinition<T>

  /** SQLite database instance */
  private readonly db: SQLiteDatabase
  private readonly sql: SQLiteBoundary

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
    const emitter = this._emitter
    transactionManager(this.db).event(() => {
      emitter.dispatch(event, payload)
    })
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
    options?: RetryableOptions,
    operationName = "collection"
  ): Promise<R> {
    if (isDatabaseClosed(this.db)) {
      return Promise.reject(new ConnectionError("StrataDB database is closed"))
    }
    return sqliteOperation.run(operationName, () =>
      withRetry(async () => {
        try {
          assertDatabaseOpen(this.db)
          assertOperationAllowed(this.db, operationName)
          return await transactionManager(this.db).run(operation)
        } catch (error) {
          throw wrapSqliteError(error, {
            collection: this.name,
            operation: operationName,
          })
        }
      }, options)
    )
  }

  private visibleDocument(doc: T): T {
    if (this.schema.timestamps !== false) {
      return doc
    }
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...visible } = doc
    return visible as T
  }

  private hydrate(row: StoredRow, internal = false): T {
    const doc = {
      ...JSON.parse(row.body),
      _id: row._id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as T
    return internal ? doc : this.visibleDocument(doc)
  }

  private validateMutationDocument(doc: T): void {
    if (this.schema.validate && !this.schema.validate(doc)) {
      throw new ValidationError(
        "Document validation failed during mutation",
        undefined,
        doc
      )
    }
  }

  private serializeDocument(doc: T): string {
    const {
      _id: _identity,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...body
    } = doc
    return stringify(body)
  }

  private readOneSync(
    filter: string | QueryFilter<T>,
    sort?: SortSpec<T>
  ): T | null {
    const translated = this.translator.translate(this.normalizeFilter(filter))
    const options = this.translator.translateOptions(
      sort ? { sort, limit: 1 } : { limit: 1 }
    )
    const row = this.sql
      .prepare<StoredRow, SQLQueryBindings[]>(
        `SELECT _id, json(body) AS body, createdAt, updatedAt FROM ${this.tableSql} WHERE ${translated.sql} ${options.sql}`
      )
      .get(...translated.params, ...options.params)
    return row ? this.hydrate(row, true) : null
  }

  private buildMutationDocument(context: {
    kind: "update" | "replace"
    before: T | null
    filter: string | QueryFilter<T>
    data: Partial<T>
    now: number
    atomic: AtomicPlan | null
  }): T {
    const { kind, before, filter, data, now, atomic } = context
    const equalities = seedEqualities(
      typeof filter === "string"
        ? { _id: filter }
        : Object.fromEntries(
            Object.entries(filter).filter(
              ([key, value]) =>
                !key.startsWith("$") &&
                (value === null || typeof value !== "object")
            )
          )
    )
    let contents: Partial<T> = data
    if (atomic) {
      contents = applyAtomicUpdate((before ?? equalities) as Partial<T>, atomic)
    } else if (!before) {
      contents = { ...equalities, ...data } as Partial<T>
    } else if (kind === "update") {
      contents = mergeDocumentUpdate<T, T>(before, {
        ...data,
        _id: before._id,
      } as T)
    }
    const after = buildCompleteDocument<T>(
      contents as Omit<T, "_id" | "createdAt" | "updatedAt">,
      {
        _id:
          before?._id ??
          (typeof equalities._id === "string"
            ? equalities._id
            : this.idGenerator()),
        createdAt:
          typeof before?.createdAt === "number" ? before.createdAt : now,
        updatedAt: now,
      }
    )
    if (this.schema.validate && !this.schema.validate(after)) {
      throw new ValidationError(
        "Document validation failed during atomic mutation",
        undefined,
        after
      )
    }

    return after
  }

  private writeMutation(
    after: T,
    exists: boolean,
    now: number,
    atomic: AtomicPlan | null
  ): void {
    if (exists) {
      if (atomic) {
        const params: SQLQueryBindings[] = []
        const body = positional(compileAtomicBody(atomic, params), params)
        this.sql
          .prepare(
            `UPDATE ${this.tableSql} SET body = ${body.sql}, updatedAt = ? WHERE _id = ?`
          )
          .run(...body.params, now, after._id)
        return
      }
      this.sql
        .prepare(
          `UPDATE ${this.tableSql} SET body = jsonb(?), updatedAt = ? WHERE _id = ?`
        )
        .run(this.serializeDocument(after), now, after._id)
    } else {
      this.sql
        .prepare(
          `INSERT INTO ${this.tableSql} (_id, body, createdAt, updatedAt) VALUES (?, jsonb(?), ?, ?)`
        )
        .run(after._id, this.serializeDocument(after), now, now)
    }
  }

  private mutateOne(
    kind: "update" | "replace" | "delete",
    filter: string | QueryFilter<T>,
    data: Partial<T>,
    options?: { sort?: SortSpec<T>; upsert?: boolean; signal?: AbortSignal }
  ): MutationResult<T> {
    assertDatabaseOpen(this.db)
    throwIfAborted(options?.signal)
    const atomic = kind === "update" ? parseAtomicUpdate(data) : null
    const result = this.db
      .transaction(() => {
        const before = this.readOneSync(filter, options?.sort)
        if (kind === "delete") {
          if (before) {
            this.sql
              .prepare(`DELETE FROM ${this.tableSql} WHERE _id = ?`)
              .run(before._id)
          }
          return { before, after: null, upserted: false }
        }
        if (!(before || options?.upsert)) {
          return { before: null, after: null, upserted: false }
        }
        const now = Date.now()
        const after = this.buildMutationDocument({
          kind,
          before,
          filter,
          data,
          now,
          atomic,
        })
        throwIfAborted(options?.signal)
        this.writeMutation(after, before !== null, now, atomic)
        return { before, after, upserted: !before }
      })
      .immediate()
    return {
      before: result.before ? this.visibleDocument(result.before) : null,
      after: result.after ? this.visibleDocument(result.after) : null,
      upserted: result.upserted,
    }
  }

  private writeBatchUpdates(context: {
    docs: readonly T[]
    now: number
    atomic: AtomicPlan | null
    whereClause: string
    params: SQLQueryBindings[]
  }): string[] {
    const { docs, now, atomic, whereClause, params } = context
    if (atomic) {
      const bodyParams: SQLQueryBindings[] = []
      const body = positional(compileAtomicBody(atomic, bodyParams), bodyParams)
      return this.sql
        .prepare<{ _id: string }, SQLQueryBindings[]>(
          `UPDATE ${this.tableSql} SET body = ${body.sql}, updatedAt = ? WHERE ${whereClause} RETURNING _id`
        )
        .all(...body.params, now, ...params)
        .map((row) => row._id)
    }
    const statement = this.sql.prepare<{ _id: string }, SQLQueryBindings[]>(
      `UPDATE ${this.tableSql} SET body = jsonb(?), updatedAt = ? WHERE _id = ? RETURNING _id`
    )
    return docs.flatMap((doc) => {
      const row = statement.get(this.serializeDocument(doc), now, doc._id)
      return row ? [row._id] : []
    })
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
    this.sql = new SQLiteBoundary(db, name)
    this.name = name
    this.schema = schema
    this.idGenerator = idGenerator
    this.translator = new SQLiteQueryTranslator(schema, { enableCache })
    this.retryOptions = mergeRetryOptions(
      databaseRetryOptions,
      collectionRetryOptions
    )

    // Initialize table and indexes
    transactionManager(this.db).assertSynchronousAccess()
    if (isDatabaseReadonly(this.db)) {
      for (const field of this.schema.fields) {
        fieldPath(String(field.name))
      }
      evolveGeneratedColumns({
        database: this.db,
        sql: this.sql,
        collection: this.name,
        schema: this.schema,
        readonly: true,
      })
      return
    }
    sqliteCall(
      () => this.db.transaction(() => this.createTable()).immediate(),
      {
        collection: this.name,
        operation: "schema",
      }
    )
    this.db.clearQueryCache()
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
    quoteIdent(this.name)
    for (const field of this.schema.fields) {
      fieldPath(String(field.name))
    }
    const columns: string[] = [
      "_id TEXT PRIMARY KEY",
      "body BLOB NOT NULL",
      "createdAt INTEGER NOT NULL",
      "updatedAt INTEGER NOT NULL",
    ]

    // Add generated columns for indexed fields
    for (const field of this.schema.fields) {
      if (field.indexed) {
        const columnName = generatedColumn(String(field.name))
        const sqlType = this.mapTypeToSQLite(field.type)
        const expression = ddlField(String(field.name))
        columns.push(
          `${columnName} ${sqlType} GENERATED ALWAYS AS (${expression}) VIRTUAL`
        )
      }
    }

    // Create table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.tableSql} (
        ${columns.join(",\n        ")}
      )
    `
    this.sql.run(createTableSQL)

    evolveGeneratedColumns({
      database: this.db,
      sql: this.sql,
      collection: this.name,
      schema: this.schema,
    })

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
        const columnName = generatedColumn(String(field.name))
        const indexName = quoteIdent(`idx_${this.name}_${String(field.name)}`)
        const uniqueKeyword = field.unique ? "UNIQUE" : ""

        const createIndexSQL = `
          CREATE ${uniqueKeyword} INDEX IF NOT EXISTS ${indexName}
          ON ${this.tableSql}(${columnName})
        `
        this.sql.run(createIndexSQL)
      }
    }
    for (const index of this.schema.compoundIndexes ?? []) {
      if (!Array.isArray(index.fields) || index.fields.length === 0) {
        throw new SchemaValidationError(
          "A compound index requires at least one field"
        )
      }
      const name = compoundIndexName(this.name, index.name)
      const columns = index.fields.map((field) =>
        resolveDDLField(String(field), this.schema.fields)
      )
      const unique = index.unique ? "UNIQUE" : ""
      this.sql.run(
        `CREATE ${unique} INDEX IF NOT EXISTS ${name} ON ${this.tableSql} (${columns.join(", ")})`
      )
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
  ): { sql: string; params: SQLQueryBindings[] } | undefined {
    if (!search.text || search.fields.length === 0) {
      return
    }

    const pattern = `%${escapeLikeLiteral(search.text)}%`
    const clauses: string[] = []
    const params: SQLQueryBindings[] = []

    for (const field of search.fields) {
      const column = resolveField(String(field), this.schema.fields, params)
      clauses.push(
        search.caseSensitive
          ? `instr(${column}, ${bind(search.text, params)}) > 0`
          : `lower(${column}) LIKE lower(${bind(pattern, params)}) ESCAPE '\\'`
      )
    }

    return {
      ...positional(`(${clauses.join(" OR ")})`, params),
    }
  }

  /**
   * Builds SQL WHERE clause for cursor-based pagination.
   *
   * @param cursor - Cursor specification with after/before
   * @param sort - Sort specification (required for cursor pagination)
   * @returns Object with SQL clause and parameters, or undefined if no cursor
   *
   * @remarks
   * Compares all sort keys and the stable ID tie-breaker, with explicit NULL
   * ordering. Missing boundary rows reject. The caller reverses query order
   * for nearest-previous-page selection and restores result order afterward.
   *
   * @internal
   */
  private buildCursorClause(
    cursor: CursorSpec,
    sort: SortSpec<T>
  ): { sql: string; params: SQLQueryBindings[] } | undefined {
    return buildCursorPredicate({
      sql: this.sql,
      collection: this.name,
      schema: this.schema,
      cursor,
      sort,
    })
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

        const stmt = this.sql.prepare<StoredRow, [string]>(
          `SELECT _id, json(body) as body, createdAt, updatedAt FROM ${this.tableSql} WHERE _id = ?`
        )
        const row = stmt.get(id)

        if (!row) {
          return Promise.resolve(null)
        }

        return Promise.resolve(this.hydrate(row))
      },
      this.buildRetryOptions(options?.retry, options?.signal),
      "findById"
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

        const cursorPlan = cursorOrder(options?.sort, options?.cursor)

        let sql = `SELECT _id, json(body) as body, createdAt, updatedAt FROM ${this.tableSql}`

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
        if (options?.cursor && cursorPlan.sort) {
          const cursorResult = this.buildCursorClause(
            options.cursor,
            cursorPlan.sort
          )
          if (cursorResult) {
            whereParts.push(cursorResult.sql)
            allParams.push(...cursorResult.params)
          }
        }

        if (whereParts.length > 0) {
          sql += ` WHERE ${whereParts.join(" AND ")}`
        }

        const translatedOptions = this.translator.translateOptions({
          ...options,
          ...(cursorPlan.sort
            ? {
                sort: cursorPlan.reverse
                  ? reverseSort(cursorPlan.sort)
                  : cursorPlan.sort,
              }
            : {}),
        })
        if (translatedOptions.sql) {
          sql += ` ${translatedOptions.sql}`
          allParams.push(...translatedOptions.params)
        }

        const stmt = this.sql.prepare<StoredRow, SQLQueryBindings[]>(sql)
        const rows = stmt.all(...allParams)

        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        let results = (cursorPlan.reverse ? rows.reverse() : rows).map((row) =>
          this.hydrate(row)
        )

        // Apply projection (select/omit/projection)
        const projection = this.normalizeProjection(options)
        if (projection) {
          results = this.applyProjection(results, projection) as T[]
        }

        return Promise.resolve(results)
      },
      this.buildRetryOptions(options?.retry, options?.signal),
      "find"
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

        let sql = `SELECT COUNT(*) as count FROM ${this.tableSql}`
        if (whereClause) {
          sql += ` WHERE ${whereClause}`
        }

        const stmt = this.sql.prepare<{ count: number }, SQLQueryBindings[]>(
          sql
        )
        const row = stmt.get(...params)
        return Promise.resolve(row?.count ?? 0)
      },
      this.buildRetryOptions(options?.retry, options?.signal),
      "count"
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
        const docId = fullDoc._id
        const body = this.serializeDocument(fullDoc)

        try {
          const stmt = this.sql.prepare(
            `INSERT INTO ${this.tableSql} (_id, body, createdAt, updatedAt) VALUES (?, jsonb(?), ?, ?)`
          )
          stmt.run(docId, body, now, now)

          // Emit insert event after successful operation
          const document = this.visibleDocument(fullDoc)
          this.emitEvent("insert", () => ({ document }))

          return Promise.resolve(document)
        } catch (error) {
          if (error instanceof UniqueConstraintError && error.field) {
            Object.assign(error, {
              value: (fullDoc as Record<string, unknown>)[error.field],
            })
          }
          throw error
        }
      },
      this.buildRetryOptions(options?.retry, options?.signal),
      "insertOne"
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
  updateOne(
    filter: string | QueryFilter<T>,
    update: DocumentUpdate<T>,
    options?: { upsert?: boolean; signal?: AbortSignal }
  ): Promise<T | null> {
    return this.runOperation(
      () => {
        const result = this.mutateOne(
          "update",
          filter,
          update as Partial<T>,
          options
        )
        if (result.upserted && result.after) {
          this.emitEvent("insert", () => ({ document: result.after as T }))
        }
        if (result.after) {
          const document = result.after
          this.emitEvent("update", () => ({
            filter,
            update,
            document,
            upserted: result.upserted,
          }))
        }
        return Promise.resolve(result.after)
      },
      this.buildRetryOptions(undefined, options?.signal),
      "updateOne"
    )
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
        const result = this.mutateOne(
          "replace",
          filter,
          doc as Partial<T>,
          options
        )
        this.emitEvent("replace", () => ({ filter, document: result.after }))
        return Promise.resolve(result.after)
      },
      this.buildRetryOptions(options?.retry, options?.signal),
      "replaceOne"
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
    options?: {
      signal?: AbortSignal
      retry?: RetryOptions | false
      includeDocument?: boolean
    }
  ): Promise<boolean> {
    return this.runOperation(
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        const normalizedFilter = this.normalizeFilter(filter)

        const { sql: whereClause, params } =
          this.translator.translate(normalizedFilter)
        const returning = options?.includeDocument
          ? "_id, json(body) as body, createdAt, updatedAt"
          : "_id"
        const row = this.sql
          .prepare<StoredRow, SQLQueryBindings[]>(
            `DELETE FROM ${this.tableSql} WHERE _id = (SELECT _id FROM ${this.tableSql} WHERE ${whereClause} LIMIT 1) RETURNING ${returning}`
          )
          .get(...params)
        if (row) {
          const document = options?.includeDocument
            ? this.hydrate(row)
            : undefined
          this.emitEvent("delete", () => ({
            filter,
            deleted: true,
            _id: row._id,
            ...(document ? { document } : {}),
          }))
        } else {
          this.emitEvent("delete", () => ({
            filter,
            deleted: false,
            _id: null,
          }))
        }
        return Promise.resolve(row !== null)
      },
      this.buildRetryOptions(options?.retry, options?.signal),
      "deleteOne"
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
      () =>
        Promise.resolve(
          // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: complex batch insert logic
          transactionManager(this.db).sync(() => {
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

            const stmt = this.sql.prepare(
              `INSERT INTO ${this.tableSql} (_id, body, createdAt, updatedAt) VALUES (?, jsonb(?), ?, ?)`
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

                const docId = fullDoc._id
                const body = this.serializeDocument(fullDoc)
                stmt.run(docId, body, now, now)

                insertedDocs.push(this.visibleDocument(fullDoc))
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

            return {
              documents: insertedDocs,
              insertedCount: insertedDocs.length,
            }
          })
        ),
      this.buildRetryOptions(options?.retry, options?.signal),
      "insertMany"
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
    update: DocumentUpdate<T>,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<UpdateResult> {
    return this.runOperation(
      () =>
        Promise.resolve(
          transactionManager(this.db).sync(() => {
            assertDatabaseOpen(this.db)
            throwIfAborted(options?.signal)

            const atomic = parseAtomicUpdate(update)
            const { sql: whereClause, params } =
              this.translator.translate(filter)

            // Find all matching documents
            let selectSql = `SELECT _id, json(body) as body, createdAt, updatedAt FROM ${this.tableSql}`
            if (whereClause) {
              selectSql += ` WHERE ${whereClause}`
            }

            const stmt = this.sql.prepare<StoredRow, SQLQueryBindings[]>(
              selectSql
            )
            const rows = stmt.all(...params)
            const matchedCount = rows.length

            if (matchedCount === 0) {
              // Emit updateMany event even when no matches
              this.emitEvent("updateMany", () => ({
                ids: [],
                filter,
                update,
                matchedCount: 0,
                modifiedCount: 0,
              }))

              return {
                matchedCount: 0,
                modifiedCount: 0,
              }
            }

            const now = Date.now()
            const updatedDocs: T[] = []

            // Prepare all updated documents and validate before committing
            for (const row of rows) {
              assertDatabaseOpen(this.db)
              throwIfAborted(options?.signal)

              const existingDoc = this.hydrate(row, true)
              const mergedDoc = atomic
                ? applyAtomicUpdate({ ...existingDoc, updatedAt: now }, atomic)
                : mergeDocumentUpdate<
                    T,
                    typeof update & { _id: string; updatedAt: number }
                  >(existingDoc, {
                    ...update,
                    _id: row._id,
                    updatedAt: now,
                  })

              this.validateMutationDocument(mergedDoc)

              updatedDocs.push(mergedDoc)
            }

            const ids = this.writeBatchUpdates({
              docs: updatedDocs,
              now,
              atomic,
              whereClause,
              params,
            })

            // Emit updateMany event after successful operation
            this.emitEvent("updateMany", () => ({
              ids,
              filter,
              update,
              matchedCount,
              modifiedCount: ids.length,
            }))

            return {
              matchedCount,
              modifiedCount: ids.length,
            }
          })
        ),
      this.buildRetryOptions(options?.retry, options?.signal),
      "updateMany"
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
      () =>
        Promise.resolve(
          transactionManager(this.db).sync(() => {
            assertDatabaseOpen(this.db)
            throwIfAborted(options?.signal)

            const { sql: whereClause, params } =
              this.translator.translate(filter)

            let sql = `DELETE FROM ${this.tableSql}`
            if (whereClause) {
              sql += ` WHERE ${whereClause}`
            }

            const rows = this.sql
              .prepare<{ _id: string }, SQLQueryBindings[]>(
                `${sql} RETURNING _id`
              )
              .all(...params)
            const ids = rows.map((row) => row._id)
            const deletedCount = ids.length

            // Emit deleteMany event after successful operation
            this.emitEvent("deleteMany", () => ({
              ids,
              filter,
              deletedCount,
            }))

            return {
              deletedCount,
            }
          })
        ),
      this.buildRetryOptions(options?.retry, options?.signal),
      "deleteMany"
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
  findOneAndDelete(
    filter: string | QueryFilter<T>,
    options?: {
      sort?: SortSpec<T>
      signal?: AbortSignal
      retry?: RetryOptions | false
    }
  ): Promise<T | null> {
    return this.runOperation(
      () => {
        const result = this.mutateOne("delete", filter, {}, options)
        this.emitEvent("findOneAndDelete", () => ({
          filter,
          document: result.before,
        }))
        return Promise.resolve(result.before)
      },
      this.buildRetryOptions(options?.retry, options?.signal),
      "findOneAndDelete"
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
  findOneAndUpdate(
    filter: string | QueryFilter<T>,
    update: DocumentUpdate<T>,
    options?: {
      sort?: SortSpec<T>
      returnDocument?: "before" | "after"
      upsert?: boolean
      signal?: AbortSignal
      retry?: RetryOptions | false
    }
  ): Promise<T | null> {
    return this.runOperation(
      () => {
        const result = this.mutateOne(
          "update",
          filter,
          update as Partial<T>,
          options
        )
        if (result.upserted && result.after) {
          this.emitEvent("insert", () => ({ document: result.after as T }))
        }
        if (result.before && result.after) {
          const after = result.after
          this.emitEvent("update", () => ({
            filter,
            update,
            upserted: false,
            document: after,
          }))
        }
        const document =
          options?.returnDocument === "before" ? result.before : result.after
        this.emitEvent("findOneAndUpdate", () => ({
          filter,
          update,
          document,
          upserted: result.upserted,
        }))
        return Promise.resolve(document)
      },
      this.buildRetryOptions(options?.retry, options?.signal),
      "findOneAndUpdate"
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
  findOneAndReplace(
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
      () => {
        const result = this.mutateOne(
          "replace",
          filter,
          replacement as Partial<T>,
          options
        )
        if (result.upserted && result.after) {
          this.emitEvent("insert", () => ({ document: result.after as T }))
        }
        if (result.before) {
          this.emitEvent("replace", () => ({ filter, document: result.after }))
        }
        const document =
          options?.returnDocument === "before" ? result.before : result.after
        this.emitEvent("findOneAndReplace", () => ({
          filter,
          document,
          upserted: result.upserted,
        }))
        return Promise.resolve(document)
      },
      this.buildRetryOptions(options?.retry, options?.signal),
      "findOneAndReplace"
    )
  }

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

        const columnParams: SQLQueryBindings[] = []
        const column = resolveField(
          String(field),
          this.schema.fields,
          columnParams
        )
        const selection = positional(
          `SELECT DISTINCT ${column} as value FROM ${this.tableSql}`,
          columnParams
        )
        let sql = selection.sql
        const params: SQLQueryBindings[] = [...selection.params]

        if (filter) {
          const { sql: whereClause, params: filterParams } =
            this.translator.translate(filter)
          if (whereClause) {
            sql += ` WHERE ${whereClause}`
            params.push(...filterParams)
          }
        }

        sql += " ORDER BY value"

        const stmt = this.sql.prepare<{ value: T[K] }, SQLQueryBindings[]>(sql)
        const rows = stmt.all(...params)

        return Promise.resolve(rows.map((row) => row.value))
      },
      this.buildRetryOptions(options?.retry, options?.signal),
      "distinct"
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
        const stmt = this.sql.prepare<{ count: number }, []>(
          `SELECT COUNT(*) as count FROM ${this.tableSql}`
        )
        const result = stmt.get()
        return Promise.resolve(result?.count ?? 0)
      },
      this.buildRetryOptions(options?.retry, options?.signal),
      "estimatedDocumentCount"
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
      () =>
        Promise.resolve(
          transactionManager(this.db).sync(() => {
            assertDatabaseOpen(this.db)
            throwIfAborted(options?.signal)
            this.sql.exec(`DROP TABLE IF EXISTS ${this.tableSql}`)

            // Emit drop event after successful operation
            this.emitEvent("drop", () => ({
              name: this.name,
            }))

            // Clean up event resources after emitting drop event
            transactionManager(this.db).event(() => this.cleanupEvents())

            return
          })
        ),
      this.buildRetryOptions(options?.retry, options?.signal),
      "drop"
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
      this.buildRetryOptions(options?.retry, options?.signal),
      "validate"
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
