# Historical collection events proposal

This is the original implementation proposal, retained for design history.
For current payloads, commit buffering, listener isolation and raw hook caveats,
read [Collection Events](../guide/events.md) and [the current architecture](../DESIGN.md).

# StrataDB Collection Events - Design Document

## Executive Summary

This document outlines the design for adding EventEmitter support to StrataDB collections. The feature will allow users to register listeners on collections to react to document lifecycle events (create, update, delete, etc.). This enables use cases like audit logging, cache invalidation, real-time notifications, and data synchronization.

## Goals

1. **Event-Driven Architecture**: Enable reactive patterns for document operations
2. **Type Safety**: Full TypeScript support for event types and payloads
3. **Performance**: Minimal overhead when no listeners are registered
4. **Consistency**: Events should fire reliably after successful operations
5. **Flexibility**: Support both synchronous and asynchronous event handlers
6. **MongoDB Parity**: Follow patterns familiar to MongoDB users (change streams concept)

## Non-Goals

1. **Cross-Process Events**: Events are local to the process only
2. **Persistence**: Events are not persisted or replayed
3. **Transactions**: Events don't participate in transaction rollback (fire after commit)
4. **Distributed Events**: No pub/sub across multiple instances

## Technology Stack

- **EventEmitter**: Node.js `events` module (fully supported by Bun)
- **Type System**: TypeScript generics for type-safe event payloads

## Event Types

### Collection Events

| Event Name | Trigger | Payload |
|------------|---------|---------|
| `insert` | After `insertOne` succeeds | `{ document: T }` |
| `insertMany` | After `insertMany` succeeds | `{ documents: readonly T[], insertedCount: number }` |
| `update` | After `updateOne` succeeds | `{ filter: QueryFilter<T> \| string, update: Partial<T>, document: T \| null, upserted: boolean }` |
| `updateMany` | After `updateMany` succeeds | `{ filter: QueryFilter<T>, update: Partial<T>, matchedCount: number, modifiedCount: number }` |
| `replace` | After `replaceOne` succeeds | `{ filter: QueryFilter<T> \| string, document: T \| null }` |
| `delete` | After `deleteOne` succeeds | `{ filter: QueryFilter<T> \| string, deleted: boolean }` |
| `deleteMany` | After `deleteMany` succeeds | `{ filter: QueryFilter<T>, deletedCount: number }` |
| `findOneAndDelete` | After `findOneAndDelete` succeeds | `{ filter: QueryFilter<T> \| string, document: T \| null }` |
| `findOneAndUpdate` | After `findOneAndUpdate` succeeds | `{ filter: QueryFilter<T> \| string, update: Partial<T>, document: T \| null, upserted: boolean }` |
| `findOneAndReplace` | After `findOneAndReplace` succeeds | `{ filter: QueryFilter<T> \| string, document: T \| null, upserted: boolean }` |
| `drop` | After `drop` succeeds | `{ name: string }` |
| `error` | On any operation error | `{ operation: string, error: Error, context?: unknown }` |

### Event Timing

Events fire **after** the operation completes successfully:
- For single operations: after the document is persisted
- For batch operations: after all documents are persisted
- For transactions: after the transaction commits (future consideration)

## Type Definitions

```typescript
// src/collection-events.ts

import { EventEmitter } from 'node:events'
import type { Document } from './core-types.js'
import type { QueryFilter } from './query-types.js'

/**
 * Event payload for single document insert operations.
 */
export type InsertEvent<T extends Document> = {
  /** The inserted document with generated _id */
  readonly document: T
}

/**
 * Event payload for batch insert operations.
 */
export type InsertManyEvent<T extends Document> = {
  /** Array of inserted documents */
  readonly documents: readonly T[]
  /** Number of documents successfully inserted */
  readonly insertedCount: number
}

/**
 * Event payload for single document update operations.
 */
export type UpdateEvent<T extends Document> = {
  /** The filter used to find the document (string ID or QueryFilter) */
  readonly filter: string | QueryFilter<T>
  /** The update that was applied */
  readonly update: Partial<T>
  /** The document after update, or null if not found (without upsert) */
  readonly document: T | null
  /** Whether this was an upsert (document was created) */
  readonly upserted: boolean
}

/**
 * Event payload for batch update operations.
 */
export type UpdateManyEvent<T extends Document> = {
  /** The filter used to find documents */
  readonly filter: QueryFilter<T>
  /** The update that was applied */
  readonly update: Partial<T>
  /** Number of documents that matched the filter */
  readonly matchedCount: number
  /** Number of documents that were modified */
  readonly modifiedCount: number
}

/**
 * Event payload for replace operations.
 */
export type ReplaceEvent<T extends Document> = {
  /** The filter used to find the document */
  readonly filter: string | QueryFilter<T>
  /** The document after replacement, or null if not found */
  readonly document: T | null
}

/**
 * Event payload for single document delete operations.
 */
export type DeleteEvent<T extends Document> = {
  /** The filter used to find the document */
  readonly filter: string | QueryFilter<T>
  /** Whether a document was deleted */
  readonly deleted: boolean
}

/**
 * Event payload for batch delete operations.
 */
export type DeleteManyEvent<T extends Document> = {
  /** The filter used to find documents */
  readonly filter: QueryFilter<T>
  /** Number of documents deleted */
  readonly deletedCount: number
}

/**
 * Event payload for findOneAndDelete operations.
 */
export type FindOneAndDeleteEvent<T extends Document> = {
  /** The filter used to find the document */
  readonly filter: string | QueryFilter<T>
  /** The deleted document, or null if not found */
  readonly document: T | null
}

/**
 * Event payload for findOneAndUpdate operations.
 */
export type FindOneAndUpdateEvent<T extends Document> = {
  /** The filter used to find the document */
  readonly filter: string | QueryFilter<T>
  /** The update that was applied */
  readonly update: Partial<T>
  /** The document (before or after based on options), or null if not found */
  readonly document: T | null
  /** Whether this was an upsert (document was created) */
  readonly upserted: boolean
}

/**
 * Event payload for findOneAndReplace operations.
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
 */
export type DropEvent = {
  /** The collection name that was dropped */
  readonly name: string
}

/**
 * Event payload for error events.
 */
export type ErrorEvent = {
  /** The operation that failed */
  readonly operation: string
  /** The error that occurred */
  readonly error: Error
  /** Additional context about the operation */
  readonly context?: unknown
}

/**
 * Map of event names to their payload types for a collection.
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
 */
export type CollectionEventName = keyof CollectionEventMap<Document>

/**
 * Typed EventEmitter for collection events.
 */
export class CollectionEventEmitter<T extends Document> extends EventEmitter<CollectionEventMap<T>> {
  constructor() {
    super()
  }
}
```

## API Design

### Collection Interface Updates

```typescript
// Updates to src/collection-types.ts

export type Collection<T extends Document> = {
  // ... existing methods ...

  /**
   * Register an event listener for collection events.
   *
   * @param event - The event name to listen for
   * @param listener - The callback function to invoke
   * @returns The collection instance for chaining
   *
   * @example
   * ```typescript
   * users.on('insert', (event) => {
   *   console.log(`New user created: ${event.document._id}`)
   *   auditLog.record('user.created', event.document)
   * })
   *
   * users.on('delete', (event) => {
   *   if (event.deleted) {
   *     cache.invalidate(`user:${event.filter}`)
   *   }
   * })
   *
   * users.on('error', (event) => {
   *   errorTracker.capture(event.error, { operation: event.operation })
   * })
   * ```
   */
  on<E extends CollectionEventName>(
    event: E,
    listener: (...args: CollectionEventMap<T>[E]) => void
  ): this

  /**
   * Register a one-time event listener.
   *
   * @param event - The event name to listen for
   * @param listener - The callback function to invoke once
   * @returns The collection instance for chaining
   */
  once<E extends CollectionEventName>(
    event: E,
    listener: (...args: CollectionEventMap<T>[E]) => void
  ): this

  /**
   * Remove an event listener.
   *
   * @param event - The event name
   * @param listener - The callback function to remove
   * @returns The collection instance for chaining
   */
  off<E extends CollectionEventName>(
    event: E,
    listener: (...args: CollectionEventMap<T>[E]) => void
  ): this

  /**
   * Remove all listeners for an event, or all events if no event specified.
   *
   * @param event - Optional event name
   * @returns The collection instance for chaining
   */
  removeAllListeners(event?: CollectionEventName): this

  /**
   * Get the number of listeners for an event.
   *
   * @param event - The event name
   * @returns Number of listeners
   */
  listenerCount(event: CollectionEventName): number

  /**
   * Get all listeners for an event.
   *
   * @param event - The event name
   * @returns Array of listener functions
   */
  listeners<E extends CollectionEventName>(
    event: E
  ): ((...args: CollectionEventMap<T>[E]) => void)[]
}
```

### Usage Examples

```typescript
import { Strata, createSchema, type Document } from 'stratadb'

type User = Document<{
  name: string
  email: string
  age: number
}>

const userSchema = createSchema<User>()
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .field('age', { type: 'INTEGER', indexed: true })
  .build()

const db = new Strata({ database: 'app.db' })
const users = db.collection('users', userSchema)

// Audit logging
users.on('insert', (event) => {
  auditLog.record({
    action: 'user.created',
    documentId: event.document._id,
    timestamp: Date.now()
  })
})

users.on('update', (event) => {
  auditLog.record({
    action: event.upserted ? 'user.created' : 'user.updated',
    documentId: event.document?._id,
    changes: event.update,
    timestamp: Date.now()
  })
})

users.on('delete', (event) => {
  auditLog.record({
    action: 'user.deleted',
    filter: event.filter,
    success: event.deleted,
    timestamp: Date.now()
  })
})

// Cache invalidation
users.on('update', (event) => {
  if (event.document) {
    cache.invalidate(`user:${event.document._id}`)
  }
})

users.on('delete', (event) => {
  if (typeof event.filter === 'string') {
    cache.invalidate(`user:${event.filter}`)
  }
})

// Real-time notifications
users.on('insert', (event) => {
  websocket.broadcast('user:created', {
    id: event.document._id,
    name: event.document.name
  })
})

// Error monitoring
users.on('error', (event) => {
  errorTracker.capture(event.error, {
    operation: event.operation,
    context: event.context
  })
})

// One-time setup listener
users.once('insert', (event) => {
  console.log('First user created:', event.document._id)
})
```

## Implementation Plan

### Phase 1: Core Event Infrastructure

**File: `src/collection-events.ts`** (new file)

1. Define all event payload types
2. Create `CollectionEventMap` type
3. Create `CollectionEventEmitter` class extending Node.js EventEmitter

### Phase 2: SQLiteCollection Integration

**File: `src/sqlite-collection.ts`** (modify)

1. Add `CollectionEventEmitter` instance to `SQLiteCollection` using **lazy initialization** (created on first `on()` call)
2. Add private `emit()` helper method with **listener count check** to avoid payload object creation when no listeners
3. Add event emitter proxy methods (`on`, `once`, `off`, `removeAllListeners`, `listenerCount`, `listeners`)
4. Emit events after each successful operation:
   - `insertOne` → emit `'insert'`
   - `insertMany` → emit `'insertMany'`
   - `updateOne` → emit `'update'`
   - `updateMany` → emit `'updateMany'`
   - `replaceOne` → emit `'replace'`
   - `deleteOne` → emit `'delete'`
   - `deleteMany` → emit `'deleteMany'`
   - `findOneAndDelete` → emit `'findOneAndDelete'`
   - `findOneAndUpdate` → emit `'findOneAndUpdate'`
   - `findOneAndReplace` → emit `'findOneAndReplace'`
   - `drop` → emit `'drop'`
5. Wrap operations in try/catch to emit `'error'` events on failure

### Phase 3: Collection Type Updates

**File: `src/collection-types.ts`** (modify)

1. Add event methods to `Collection` type interface
2. Import event types from `collection-events.ts`

### Phase 4: Exports

**File: `src/index.ts`** (modify)

1. Export event types for external use
2. Export `CollectionEventEmitter` class

## Implementation Details

### Lazy EventEmitter Initialization

The EventEmitter is created lazily on the first `on()` call to avoid overhead for collections that don't use events:

```typescript
// In SQLiteCollection
private _emitter: CollectionEventEmitter<T> | null = null

private get emitter(): CollectionEventEmitter<T> {
  if (!this._emitter) {
    this._emitter = new CollectionEventEmitter<T>()
  }
  return this._emitter
}
```

### Optimized Event Emission

Before emitting events, always check if there are listeners to avoid creating payload objects unnecessarily:

```typescript
/**
 * Emit an event only if there are listeners registered.
 * This avoids creating payload objects when no one is listening.
 */
private emit<E extends CollectionEventName>(
  event: E,
  createPayload: () => CollectionEventMap<T>[E][0]
): void {
  // Skip if no emitter exists (no listeners ever registered)
  if (!this._emitter) return
  
  // Skip if no listeners for this specific event
  if (this._emitter.listenerCount(event) === 0) return
  
  // Create payload and emit only when we have listeners
  this._emitter.emit(event, createPayload())
}
```

**Key points:**
- Uses a factory function `createPayload` to defer object creation
- Two-level check: first for emitter existence, then for listener count
- Zero overhead when no events are used

### Event Emission Pattern

Events are emitted **after** the operation succeeds, using the optimized emit helper:

```typescript
// Example: insertOne with event emission
async insertOne(
  doc: Omit<T, '_id' | 'createdAt' | 'updatedAt'>,
  options?: { signal?: AbortSignal; retry?: RetryOptions | false }
): Promise<T> {
  return withRetry(
    async () => {
      throwIfAborted(options?.signal)

      // ... existing insert logic ...

      const result = fullDoc

      // Emit event after successful operation (optimized)
      this.emit('insert', () => ({ document: result }))

      return result
    },
    this.buildRetryOptions(options?.retry, options?.signal)
  )
}
```

### Error Event Emission

```typescript
// Pattern for error emission (wrapped around operations)
private async withErrorEmission<R>(
  operation: string,
  context: unknown,
  fn: () => Promise<R>
): Promise<R> {
  try {
    return await fn()
  } catch (error) {
    // Use optimized emit pattern for error events
    this.emit('error', () => ({
      operation,
      error: error instanceof Error ? error : new Error(String(error)),
      context
    }))
    throw error
  }
}
```

### Resource Cleanup

Event resources must be cleaned up to prevent memory leaks:

1. **On `drop()`**: After emitting the 'drop' event, remove all listeners and nullify the emitter
2. **On database `close()`**: Clean up emitters for all collections before closing the connection

```typescript
// In SQLiteCollection
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

// In drop() method - cleanup AFTER emitting drop event
async drop(): Promise<void> {
  // ... drop logic ...
  
  this.emitEvent('drop', () => ({ name: this.name }))
  this.cleanupEvents()  // Clean up after emitting
}
```

```typescript
// In Strata class
close(): void {
  // Clean up event listeners for all collections
  for (const collection of this.collections.values()) {
    collection.cleanupEvents()
  }
  
  this.onCloseCallback?.()
  this.sqliteDb.close()
}
```

**Key points:**
- Drop event fires BEFORE cleanup (listeners can react to drop)
- Database close cleans up ALL collection emitters
- No errors if no listeners exist (safe to call on any collection)

## Testing Strategy

### Unit Tests

**File: `test/collection-events.test.ts`** (new file)

1. **Event Registration**
   - `on()` registers listener correctly
   - `once()` fires only once
   - `off()` removes listener
   - `removeAllListeners()` clears all/specific listeners
   - `listenerCount()` returns correct count
   - `listeners()` returns listener array

2. **Insert Events**
   - `insertOne` emits `'insert'` with correct payload
   - `insertMany` emits `'insertMany'` with correct payload
   - Events contain full document with `_id`, `createdAt`, `updatedAt`

3. **Update Events**
   - `updateOne` emits `'update'` with document and upserted flag
   - `updateOne` with upsert emits `'update'` with `upserted: true`
   - `updateMany` emits `'updateMany'` with counts

4. **Delete Events**
   - `deleteOne` emits `'delete'` with deleted flag
   - `deleteMany` emits `'deleteMany'` with count
   - `findOneAndDelete` emits with deleted document

5. **Replace Events**
   - `replaceOne` emits `'replace'` with new document
   - `findOneAndReplace` emits with document

6. **Error Events**
   - Failed operations emit `'error'` with operation name and error
   - Error events include context when available
   - Original error is still thrown after event emission

7. **Edge Cases**
   - No events emitted when no listeners registered
   - Events fire after operation completes (not before)
   - Multiple listeners receive same event
   - Listener errors don't affect operation result

### Integration Tests

**File: `test/collection-events-integration.test.ts`** (new file)

1. **Real-World Scenarios**
   - Audit logging pattern
   - Cache invalidation pattern
   - Error tracking pattern

2. **Concurrency**
   - Events fire correctly under concurrent operations
   - No race conditions in event delivery

## Documentation Plan

### Guide Documentation

**File: `docs/guide/events.md`** (new file)

```markdown
# Collection Events

StrataDB collections emit events when documents are created, updated, or deleted.
This enables reactive patterns like audit logging, cache invalidation, and real-time notifications.

## Quick Start

```typescript
const users = db.collection('users', userSchema)

// Listen for new documents
users.on('insert', (event) => {
  console.log('New user:', event.document._id)
})

// Listen for updates
users.on('update', (event) => {
  console.log('User updated:', event.document?._id)
})

// Listen for deletions
users.on('delete', (event) => {
  console.log('User deleted:', event.deleted)
})
```

## Available Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `insert` | `insertOne` | `{ document }` |
| `insertMany` | `insertMany` | `{ documents, insertedCount }` |
| `update` | `updateOne` | `{ filter, update, document, upserted }` |
| ... | ... | ... |

## Event Timing

Events fire **after** the operation completes successfully...

## Use Cases

### Audit Logging
### Cache Invalidation
### Real-Time Notifications
### Error Monitoring

## API Reference

### on(event, listener)
### once(event, listener)
### off(event, listener)
### removeAllListeners(event?)
### listenerCount(event)
### listeners(event)
```

### API Documentation

Update TypeDoc comments in source files for automatic API doc generation.

### VitePress Sidebar

**File: `docs/.vitepress/config.ts`** (modify)

Add `events.md` to the guide sidebar.

## Migration Considerations

This is a **non-breaking** additive change:
- Existing code continues to work unchanged
- Events are opt-in (no listeners by default)
- No changes to existing method signatures
- No performance impact when events are not used

## Future Considerations

1. **Transaction Events**: Emit events when transactions commit (not on individual operations within)
2. **Pre-Operation Events**: `beforeInsert`, `beforeUpdate`, etc. for validation/transformation
3. **Async Iterator**: `collection.watch()` returning an async iterator for change streams
4. **Event Filtering**: Subscribe to events matching specific filters
5. **Event Batching**: Coalesce rapid events for performance

## Implementation Checklist

### Core Implementation
- [ ] Create `src/collection-events.ts` with all type definitions
- [ ] Add `CollectionEventEmitter` class
- [ ] Implement lazy emitter initialization (create on first `on()` call)
- [ ] Implement optimized `emit()` helper with listener count check
- [ ] Add event proxy methods to `SQLiteCollection` (`on`, `once`, `off`, etc.)
- [ ] Emit `'insert'` event in `insertOne`
- [ ] Emit `'insertMany'` event in `insertMany`
- [ ] Emit `'update'` event in `updateOne`
- [ ] Emit `'updateMany'` event in `updateMany`
- [ ] Emit `'replace'` event in `replaceOne`
- [ ] Emit `'delete'` event in `deleteOne`
- [ ] Emit `'deleteMany'` event in `deleteMany`
- [ ] Emit `'findOneAndDelete'` event
- [ ] Emit `'findOneAndUpdate'` event
- [ ] Emit `'findOneAndReplace'` event
- [ ] Emit `'drop'` event
- [ ] Implement error event emission wrapper
- [ ] Update `Collection` type interface
- [ ] Export event types from `src/index.ts`

### Resource Cleanup
- [ ] Add `cleanupEvents()` method to `SQLiteCollection`
- [ ] Call `cleanupEvents()` in `drop()` after emitting drop event
- [ ] Track collections in `Strata` class
- [ ] Call `cleanupEvents()` for all collections in `Strata.close()`

### Testing
- [ ] Unit tests for event registration (`on`, `once`, `off`, etc.)
- [ ] Unit tests for insert events
- [ ] Unit tests for update events
- [ ] Unit tests for delete events
- [ ] Unit tests for replace events
- [ ] Unit tests for atomic operation events
- [ ] Unit tests for error events
- [ ] Unit tests for edge cases
- [ ] Integration tests for real-world patterns

### Documentation
- [ ] Create `docs/guide/events.md`
- [ ] Update `docs/.vitepress/config.ts` sidebar
- [ ] Add TypeDoc comments to all new types
- [ ] Add TypeDoc comments to all new methods
- [ ] Add examples to API documentation
- [ ] Update `docs/guide/collections.md` with events mention

### Final Steps
- [ ] Run full test suite
- [ ] Run type checking
- [ ] Run linting
- [ ] Build documentation
- [ ] Update CHANGELOG.md

## Estimated Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| Phase 1 | 1 day | Core event infrastructure |
| Phase 2 | 2 days | SQLiteCollection integration |
| Phase 3 | 0.5 day | Type updates and exports |
| Phase 4 | 2 days | Testing |
| Phase 5 | 1 day | Documentation |
| **Total** | **6.5 days** | |

## Open Questions

1. **Should we emit events for read operations?** (find, findOne, count)
   - **Recommendation**: No, these don't change state and would add overhead

2. **Should events be emitted inside or outside retry loops?**
   - **Recommendation**: Outside (after final success), so events fire once per logical operation

3. **Should we support async event handlers that block the operation?**
   - **Recommendation**: No, handlers run async by default; use explicit `await` patterns if needed

4. **Should we add a global database-level event emitter?**
   - **Recommendation**: Consider for v2; start with collection-level only
