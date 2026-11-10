import type { SQLQueryBindings } from "bun:sqlite"
import { throwIfAborted } from "./abort-utils.js"
import { applyAtomicUpdate, parseAtomicUpdate } from "./atomic-updates.js"
import type { StoredRow } from "./collection-core.js"
import type {
  Collection,
  DeleteResult,
  InsertManyResult,
  UpdateResult,
} from "./collection-types.js"
import { CollectionWriteOps } from "./collection-write-ops.js"
import type { Document, DocumentUpdate } from "./core-types.js"
import { assertDatabaseOpen } from "./database-state.js"
import { mergeDocumentUpdate } from "./deep-merge.js"
import { buildCompleteDocument } from "./document-builder.js"
import { ValidationError } from "./errors.js"
import { serializeJSON } from "./json-serialization.js"
import type { QueryFilter } from "./query-types.js"
import type { RetryOptions } from "./retry-types.js"
import { transactionManager } from "./transaction-manager.js"

type BatchDocument<T> = Omit<T, "_id" | "createdAt" | "updatedAt"> & {
  _id?: string
}

/** Collection batch writes and administrative operations. */
export class SQLiteCollection<T extends Document>
  extends CollectionWriteOps<T>
  implements Collection<T>
{
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
          transactionManager(this.db).sync(() => {
            assertDatabaseOpen(this.db)
            throwIfAborted(options?.signal)

            const ordered = options?.ordered ?? true
            // Reject serialization errors before the per-document catch path
            // can swallow them or earlier documents can be written.
            serializeJSON(docs)
            const now = Date.now()
            const insertedDocs = this.insertBatchRows(
              docs,
              now,
              ordered,
              options?.signal
            )

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

            transactionManager(this.db).event(() => {
              this.sql.dispose()
              this.onDrop?.()
            })

            // Emit drop event after successful operation
            this.emitEvent("drop", () => ({
              name: this.name,
            }))

            // Clean up event resources after emitting drop event
            transactionManager(this.db).event(() => this.cleanupEvents())
          })
        ),
      this.buildRetryOptions(options?.retry, options?.signal),
      "drop"
    )
  }

  private insertBatchRows(
    docs: readonly BatchDocument<T>[],
    now: number,
    ordered: boolean,
    signal?: AbortSignal
  ): T[] {
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

    for (let i = 0; i < docs.length; i += 1) {
      assertDatabaseOpen(this.db)
      throwIfAborted(signal)

      const doc = docs[i]
      if (!doc) {
        continue
      }

      try {
        const fullDoc = this.batchDocument(doc, now, i)
        const docId = fullDoc._id
        const body = this.serializeDocument(fullDoc)
        stmt.run(docId, body, now, now)

        insertedDocs.push(this.visibleDocument(fullDoc))
        insertedIds.push(fullDoc._id)
      } catch (error) {
        const err = this.handleInsertError(error, i, doc, errors)
        if (ordered && err) {
          break
        }
      }
    }

    return insertedDocs
  }
  private batchDocument(doc: BatchDocument<T>, now: number, i: number): T {
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

    return fullDoc
  }
}
