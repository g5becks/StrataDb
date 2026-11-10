/**
 * Collection event types and payloads for StrataDB.
 *
 * @remarks
 * This module provides type-safe event definitions for collection operations.
 * Events are emitted after successful operations and can be used for:
 * - Audit logging
 * - Cache invalidation
 * - Real-time notifications
 * - Data synchronization
 *
 * @packageDocumentation
 */

import { EventEmitter } from "node:events"
import type { Document, DocumentUpdate } from "./core-types.js"
import type { QueryFilter } from "./query-types.js"

/**
 * Event payload for single document insert operations.
 *
 * @typeParam T - The document type extending Document
 *
 * @remarks
 * Emitted after `insertOne()` successfully creates a document.
 * The payload includes the complete document with its generated `_id`.
 *
 * @example
 * ```typescript
 * collection.on('insert', (event) => {
 *   console.log(`Document inserted: ${event.document._id}`)
 * })
 * ```
 */
export type InsertEvent<T extends Document> = {
  /** The inserted document with generated _id */
  readonly document: T
}

/**
 * Event payload for batch insert operations.
 *
 * @typeParam T - The document type extending Document
 *
 * @remarks
 * Emitted after `insertMany()` completes. This includes all successfully
 * inserted documents, even if some documents failed (in unordered mode).
 *
 * @example
 * ```typescript
 * collection.on('insertMany', (event) => {
 *   console.log(`${event.insertedCount} documents inserted`)
 * })
 * ```
 */
export type InsertManyEvent<T extends Document> = {
  /** Array of inserted documents */
  readonly documents: readonly T[]
  /** Number of documents successfully inserted */
  readonly insertedCount: number
}

/**
 * Event payload for single document update operations.
 *
 * @typeParam T - The document type extending Document
 *
 * @remarks
 * Emitted after `updateOne()` successfully updates or upserts a document.
 * Emitted only for a successful update or upsert; `document` is non-null.
 * The `upserted` flag indicates whether
 * a new document was created via upsert.
 *
 * @example
 * ```typescript
 * collection.on('update', (event) => {
 *   if (event.upserted) {
 *     console.log('Document was upserted')
 *   } else if (event.document) {
 *     console.log('Document was updated')
 *   }
 * })
 * ```
 */
export type UpdateEvent<T extends Document> = {
  /** The filter used to find the document (string ID or QueryFilter) */
  readonly filter: string | QueryFilter<T>
  /** The update that was applied */
  readonly update: DocumentUpdate<T>
} & (
  | { readonly upserted: false; readonly document: T }
  | { readonly upserted: true; readonly document: T }
)

/**
 * Event payload for batch update operations.
 *
 * @typeParam T - The document type extending Document
 *
 * @remarks
 * Emitted after `updateMany()` updates multiple documents.
 * The `matchedCount` indicates how many documents matched the filter,
 * while `modifiedCount` indicates how many were actually changed.
 * These counts may differ if the update didn't change field values.
 *
 * @example
 * ```typescript
 * collection.on('updateMany', (event) => {
 *   console.log(`Updated ${event.modifiedCount} of ${event.matchedCount} matched documents`)
 * })
 * ```
 */
export type UpdateManyEvent<T extends Document> = {
  /** IDs of rows actually updated, in SQLite RETURNING order. */
  readonly ids: readonly string[]
  /** The filter used to find documents */
  readonly filter: QueryFilter<T>
  /** The update that was applied */
  readonly update: DocumentUpdate<T>
  /** Number of documents that matched the filter */
  readonly matchedCount: number
  /** Number of documents that were modified */
  readonly modifiedCount: number
}

/**
 * Event payload for replace operations.
 *
 * @typeParam T - The document type extending Document
 *
 * @remarks
 * Emitted after `replaceOne()` successfully replaces a document.
 * Unlike updates, replace operations replace the entire document
 * (except for `_id`, `createdAt`, and `updatedAt`).
 *
 * @example
 * ```typescript
 * collection.on('replace', (event) => {
 *   if (event.document) {
 *     console.log(`Document ${event.document._id} was replaced`)
 *   }
 * })
 * ```
 */
export type ReplaceEvent<T extends Document> = {
  /** The filter used to find the document */
  readonly filter: string | QueryFilter<T>
  /** The document after replacement, or null if not found */
  readonly document: T | null
}

/**
 * Event payload for single document delete operations.
 *
 * @typeParam T - The document type extending Document
 *
 * @remarks
 * Emitted after `deleteOne()` attempts to delete a document.
 * The `deleted` flag indicates whether a document was actually deleted.
 *
 * @example
 * ```typescript
 * collection.on('delete', (event) => {
 *   if (event.deleted) {
 *     console.log('Document was deleted')
 *   }
 * })
 * ```
 */
export type DeleteEvent<T extends Document> = {
  /** The filter used to find the document */
  readonly filter: string | QueryFilter<T>
} & (
  | {
      readonly deleted: true
      readonly _id: string
      /** Included only when deleteOne requests includeDocument. */
      readonly document?: T
    }
  | { readonly deleted: false; readonly _id: null; readonly document?: never }
)

/**
 * Event payload for batch delete operations.
 *
 * @typeParam T - The document type extending Document
 *
 * @remarks
 * Emitted after `deleteMany()` deletes multiple documents.
 * The `deletedCount` indicates how many documents were removed.
 *
 * @example
 * ```typescript
 * collection.on('deleteMany', (event) => {
 *   console.log(`${event.deletedCount} documents deleted`)
 * })
 * ```
 */
export type DeleteManyEvent<T extends Document> = {
  /** IDs of deleted rows, in SQLite RETURNING order. */
  readonly ids: readonly string[]
  /** The filter used to find documents */
  readonly filter: QueryFilter<T>
  /** Number of documents deleted */
  readonly deletedCount: number
}

/**
 * Event payload for findOneAndDelete operations.
 *
 * @typeParam T - The document type extending Document
 *
 * @remarks
 * Emitted after `findOneAndDelete()` finds and deletes a document.
 * The `document` field contains the deleted document, or `null` if
 * no matching document was found.
 *
 * @example
 * ```typescript
 * collection.on('findOneAndDelete', (event) => {
 *   if (event.document) {
 *     console.log(`Deleted document: ${event.document._id}`)
 *   }
 * })
 * ```
 */
export type FindOneAndDeleteEvent<T extends Document> = {
  /** The filter used to find the document */
  readonly filter: string | QueryFilter<T>
  /** The deleted document, or null if not found */
  readonly document: T | null
}

/**
 * Event payload for findOneAndUpdate operations.
 *
 * @typeParam T - The document type extending Document
 *
 * @remarks
 * Emitted after `findOneAndUpdate()` finds and updates a document.
 * The `document` field contains either the document before or after
 * the update, depending on the `returnDocument` option. The `upserted`
 * flag indicates whether a new document was created via upsert.
 *
 * @example
 * ```typescript
 * collection.on('findOneAndUpdate', (event) => {
 *   if (event.upserted) {
 *     console.log('Document was upserted')
 *   } else if (event.document) {
 *     console.log(`Document ${event.document._id} was updated`)
 *   }
 * })
 * ```
 */
export type FindOneAndUpdateEvent<T extends Document> = {
  /** The filter used to find the document */
  readonly filter: string | QueryFilter<T>
  /** The update that was applied */
  readonly update: DocumentUpdate<T>
  /** The document (before or after based on options), or null if not found */
  readonly document: T | null
  /** Whether this was an upsert (document was created) */
  readonly upserted: boolean
}

/**
 * Event payload for findOneAndReplace operations.
 *
 * @typeParam T - The document type extending Document
 *
 * @remarks
 * Emitted after `findOneAndReplace()` finds and replaces a document.
 * The `document` field contains either the document before or after
 * the replacement, depending on the `returnDocument` option. The `upserted`
 * flag indicates whether a new document was created via upsert.
 *
 * @example
 * ```typescript
 * collection.on('findOneAndReplace', (event) => {
 *   if (event.upserted) {
 *     console.log('Document was upserted')
 *   } else if (event.document) {
 *     console.log(`Document ${event.document._id} was replaced`)
 *   }
 * })
 * ```
 */
export type FindOneAndReplaceEvent<T extends Document> = {
  /** The filter used to find the document */
  readonly filter: string | QueryFilter<T>
  /** The document (before or after based on options), or null if not found */
  readonly document: T | null
  /** Whether this was an upsert (document was created) */
  readonly upserted: boolean
}

/**
 * Event payload for drop operations.
 *
 * @remarks
 * Emitted after `drop()` successfully drops a collection.
 * This is a collection-level event that includes the collection name.
 *
 * @example
 * ```typescript
 * collection.on('drop', (event) => {
 *   console.log(`Collection ${event.name} was dropped`)
 * })
 * ```
 */
export type DropEvent = {
  /** The collection name that was dropped */
  readonly name: string
}

/**
 * Event payload for error events.
 *
 * @remarks
 * Emitted when a collection listener throws or rejects. The `operation`
 * identifies its event, and `context.source` is "listener". Database operation
 * failures are delivered through their returned promises.
 *
 * @example
 * ```typescript
 * collection.on('error', (event) => {
 *   console.error(`Operation ${event.operation} failed:`, event.error)
 *   if (event.context) {
 *     console.error('Context:', event.context)
 *   }
 * })
 * ```
 */
export type ErrorEvent = {
  /** The event whose listener failed */
  readonly operation: string
  /** The error that occurred */
  readonly error: Error
  /** Additional context about the operation */
  readonly context?: unknown
}

/**
 * Map of event names to their payload types for a collection.
 *
 * @typeParam T - The document type extending Document
 *
 * @remarks
 * This type defines all available events for a collection and their
 * corresponding payload types. Each event is mapped to a tuple containing
 * the event payload type, following the EventEmitter pattern.
 *
 * The event map enables type-safe event emission and listening:
 * - TypeScript can validate event names
 * - Event handler parameters are automatically typed
 * - Autocomplete works for both event names and payload properties
 *
 * @example
 * ```typescript
 * // Type-safe event listening
 * collection.on('insert', (event) => {
 *   // event is automatically typed as InsertEvent<T>
 *   console.log(event.document._id)
 * })
 *
 * collection.on('updateMany', (event) => {
 *   // event is automatically typed as UpdateManyEvent<T>
 *   console.log(`Modified ${event.modifiedCount} documents`)
 * })
 * ```
 */
export type CollectionEventMap<T extends Document> = {
  insert: [InsertEvent<T>]
  insertMany: [InsertManyEvent<T>]
  update: [UpdateEvent<T>]
  updateMany: [UpdateManyEvent<T>]
  replace: [ReplaceEvent<T>]
  delete: [DeleteEvent<T>]
  deleteMany: [DeleteManyEvent<T>]
  findOneAndDelete: [FindOneAndDeleteEvent<T>]
  findOneAndUpdate: [FindOneAndUpdateEvent<T>]
  findOneAndReplace: [FindOneAndReplaceEvent<T>]
  drop: [DropEvent]
  error: [ErrorEvent]
}

/**
 * Type-safe event names for collections.
 *
 * @remarks
 * Union type of all valid event names that can be used with collection
 * event listeners. This ensures that only valid event names can be passed
 * to methods like `on()`, `once()`, `off()`, etc.
 *
 * @example
 * ```typescript
 * const eventName: CollectionEventName = 'insert' // Valid
 * const invalid: CollectionEventName = 'invalid' // Type error
 * ```
 */
export type CollectionEventName = keyof CollectionEventMap<Document>

/**
 * Typed EventEmitter for collection events.
 *
 * @typeParam T - The document type extending Document
 *
 * @remarks
 * This class extends Node.js EventEmitter with type-safe event handling
 * for collection operations. It uses the CollectionEventMap to provide
 * full TypeScript type safety for event names and payloads.
 *
 * The emitter is used internally by SQLiteCollection and should not be
 * instantiated directly by users. Collections automatically create and
 * manage their event emitters lazily (on first listener registration).
 *
 * @example
 * ```typescript
 * // Used internally by SQLiteCollection
 * private _emitter?: CollectionEventEmitter<T>
 *
 * // Lazily initialized on first listener registration
 * on<K extends CollectionEventName>(event: K, listener: (...args: CollectionEventMap<T>[K]) => void) {
 *   if (!this._emitter) {
 *     this._emitter = new CollectionEventEmitter<T>()
 *   }
 *   this._emitter.on(event, listener)
 *   return this
 * }
 * ```
 */
export class CollectionEventEmitter<T extends Document> extends EventEmitter<
  CollectionEventMap<T>
> {
  /** Invoke a registration snapshot in order, retaining once-wrapper behavior. */
  dispatch<E extends CollectionEventName>(
    event: E,
    payload: CollectionEventMap<T>[E][0]
  ): void {
    for (const listener of this.rawListeners(event)) {
      try {
        const result: unknown = Reflect.apply(listener, this, [payload])
        if (
          result !== null &&
          (typeof result === "object" || typeof result === "function")
        ) {
          Promise.resolve(result).catch((error: unknown) =>
            this.listenerError(event, error)
          )
        }
      } catch (error) {
        this.listenerError(event, error)
      }
    }
  }

  private listenerError(event: CollectionEventName, failure: unknown): void {
    const error =
      failure instanceof Error ? failure : new Error(String(failure))
    if (event !== "error" && this.listenerCount("error") > 0) {
      this.dispatch("error", {
        operation: event,
        error,
        context: { source: "listener", event },
      })
      return
    }
    try {
      console.error(`[StrataDB] Listener for "${event}" failed`, error)
    } catch {
      /* Logging must not fail a committed write. */
    }
  }
}
