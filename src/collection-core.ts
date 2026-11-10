import type { Database as SQLiteDatabase, SQLQueryBindings } from "bun:sqlite"
import { throwIfAborted } from "./abort-utils.js"
import {
  type AtomicPlan,
  applyAtomicUpdate,
  compileAtomicBody,
  parseAtomicUpdate,
  seedEqualities,
} from "./atomic-updates.js"
import { createTable } from "./collection-ddl.js"
import {
  CollectionEventEmitter,
  type CollectionEventMap,
  type CollectionEventName,
} from "./collection-events.js"
import { registerCollectionListener } from "./collection-listeners.js"
import type { Document } from "./core-types.js"
import {
  assertDatabaseOpen,
  assertOperationAllowed,
  isDatabaseClosed,
  isDatabaseReadonly,
} from "./database-state.js"
import { mergeDocumentUpdate } from "./deep-merge.js"
import { buildCompleteDocument } from "./document-builder.js"
import { ConnectionError, ValidationError } from "./errors.js"
import { fieldPath, positional, quoteIdent } from "./field-resolver.js"
import { generateId } from "./id-generator.js"
import { serializeJSON } from "./json-serialization.js"
import type { SortSpec } from "./query-options-types.js"
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
import { registerCasefold } from "./sqlite-casefold.js"
import { SQLiteQueryTranslator } from "./sqlite-query-translator.js"
import { registerRegex } from "./sqlite-regex.js"
import { transactionManager } from "./transaction-manager.js"
export type StoredRow = {
  _id: string
  body: string
  createdAt: number
  updatedAt: number
}
export type CollectionConfiguration = {
  idGenerator?: () => string
  enableCache?: boolean
  retryOptions?: RetryOptions | undefined
  statementCacheSize?: number
  onDrop?: () => void
}
export type MutationResult<T> = {
  before: T | null
  after: T | null
  upserted: boolean
}
/** Shared collection state, atomic mutation helpers and event lifecycle. */
export class CollectionCore<T extends Document> {
  readonly name: string

  protected get tableSql(): string {
    return quoteIdent(this.name)
  }

  readonly schema: SchemaDefinition<T>

  protected readonly db: SQLiteDatabase

  protected readonly sql: SQLiteBoundary

  protected readonly translator: SQLiteQueryTranslator<T>

  protected readonly idGenerator: () => string

  protected readonly retryOptions: RetryOptions | undefined

  protected readonly onDrop: (() => void) | undefined

  protected _emitter: CollectionEventEmitter<T> | null = null

  protected get emitter(): CollectionEventEmitter<T> {
    if (!this._emitter) {
      this._emitter = new CollectionEventEmitter<T>()
    }
    return this._emitter
  }

  protected emitEvent<E extends CollectionEventName>(
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

  protected buildRetryOptions(
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

  protected runOperation<R>(
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

  protected visibleDocument(doc: T): T {
    if (this.schema.timestamps !== false) {
      return doc
    }
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...visible } = doc
    return visible as T
  }

  protected hydrate(row: StoredRow, internal = false): T {
    const doc = {
      ...JSON.parse(row.body),
      _id: row._id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as T
    return internal ? doc : this.visibleDocument(doc)
  }

  protected validateMutationDocument(doc: T): void {
    if (this.schema.validate && !this.schema.validate(doc)) {
      throw new ValidationError(
        "Document validation failed during mutation",
        undefined,
        doc
      )
    }
  }

  protected serializeDocument(doc: T): string {
    const {
      _id: _identity,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...body
    } = doc
    return serializeJSON(body)
  }

  protected readOneSync(
    filter: string | QueryFilter<T>,
    sort?: SortSpec<T>
  ): T | null {
    const translated = this.translator.translate(this.normalizeFilter(filter))
    const options = sort
      ? this.translator.translateOptions({ sort, limit: 1 })
      : { sql: "LIMIT 1", params: [] }
    const row = this.sql
      .prepare<StoredRow, SQLQueryBindings[]>(
        `SELECT _id, json(body) AS body, createdAt, updatedAt FROM ${this.tableSql} WHERE ${translated.sql} ${options.sql}`
      )
      .get(...translated.params, ...options.params)
    return row ? this.hydrate(row, true) : null
  }

  protected buildMutationDocument(context: {
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

  protected writeMutation(
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

  protected mutateOne(
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

  protected writeBatchUpdates(context: {
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

  constructor(
    db: SQLiteDatabase,
    name: string,
    schema: SchemaDefinition<T>,
    config: CollectionConfiguration = {}
  ) {
    assertDatabaseOpen(db)
    registerRegex(db)
    registerCasefold(db)
    this.db = db
    this.sql = new SQLiteBoundary(db, name, config.statementCacheSize ?? 64)
    this.name = name
    this.schema = schema
    this.idGenerator = config.idGenerator ?? generateId
    this.translator = new SQLiteQueryTranslator(schema, {
      enableCache: config.enableCache ?? false,
    })
    this.retryOptions = config.retryOptions
    this.onDrop = config.onDrop

    // Initialize table and indexes
    try {
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
        () =>
          this.db
            .transaction(() =>
              createTable({
                db: this.db,
                sql: this.sql,
                name: this.name,
                schema: this.schema,
                tableSql: this.tableSql,
              })
            )
            .immediate(),
        {
          collection: this.name,
          operation: "schema",
        }
      )
      this.db.clearQueryCache()
    } catch (error) {
      this.sql.dispose()
      throw error
    }
  }

  protected normalizeFilter(filter: string | QueryFilter<T>): QueryFilter<T> {
    if (typeof filter === "string") {
      return { _id: filter } as QueryFilter<T>
    }
    return filter
  }

  cleanupEvents(): void {
    if (this._emitter) {
      this._emitter.removeAllListeners()
      this._emitter = null
    }
  }

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

  on<E extends CollectionEventName>(
    event: E,
    listener: (...args: CollectionEventMap<T>[E]) => void
  ): this {
    registerCollectionListener(this.emitter, "on", event, listener)
    return this
  }

  once<E extends CollectionEventName>(
    event: E,
    listener: (...args: CollectionEventMap<T>[E]) => void
  ): this {
    registerCollectionListener(this.emitter, "once", event, listener)
    return this
  }

  off<E extends CollectionEventName>(
    event: E,
    listener: (...args: CollectionEventMap<T>[E]) => void
  ): this {
    if (this._emitter) {
      registerCollectionListener(this._emitter, "off", event, listener)
    }
    return this
  }

  removeAllListeners(event?: CollectionEventName): this {
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
