import type { SQLQueryBindings } from "bun:sqlite"
import { throwIfAborted } from "./abort-utils.js"
import type { StoredRow } from "./collection-core.js"
import { CollectionReadOps } from "./collection-read-ops.js"
import type { Document, DocumentUpdate } from "./core-types.js"
import { assertDatabaseOpen } from "./database-state.js"
import { buildCompleteDocument } from "./document-builder.js"
import { UniqueConstraintError, ValidationError } from "./errors.js"
import type { SortSpec } from "./query-options-types.js"
import type { QueryFilter } from "./query-types.js"
import type { RetryOptions } from "./retry-types.js"
/** Collection write operations; public contracts are documented by Collection. */
export class CollectionWriteOps<
  T extends Document,
> extends CollectionReadOps<T> {
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

  updateOne(
    filter: string | QueryFilter<T>,
    update: DocumentUpdate<T>,
    options?: {
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
      this.buildRetryOptions(options?.retry, options?.signal),
      "updateOne"
    )
  }

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
          const { after } = result
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
}
