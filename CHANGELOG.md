# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Develop on TypeScript 7.0, with blocking TypeScript 5.9/6.0/7.0 compatibility checks and an advisory 7.1 beta CI check.
- Build with tsdown 0.23 and oxc isolated declarations, preserving `dist/index.mjs` and `dist/index.d.mts`. Public declarations inline type-fest so consumers do not need that development dependency.

### Fixed

- `collection.removeAllListeners()` now removes listeners for every event on Bun 1.4, matching Node EventEmitter semantics.

## [0.5.0] - 2026-01-09

### Added

- **Collection Events** - EventEmitter support for reactive document lifecycle events:
  ```typescript
  const users = db.collection('users', schema)
  
  // Listen for document changes
  users.on('insert', (event) => {
    console.log('New user:', event.document._id)
    auditLog.record('user.created', event.document)
  })
  
  users.on('update', (event) => {
    cache.invalidate(`user:${event.document?._id}`)
  })
  
  users.on('delete', (event) => {
    console.log('User deleted:', event.deleted)
  })
  
  // One-time listeners
  users.once('insert', (event) => {
    console.log('First user created!')
  })
  
  // Remove listeners
  users.off('insert', myListener)
  users.removeAllListeners('update')
  ```

- **Event Types** - Full TypeScript support for type-safe event payloads:
  - `insert` - Fired after `insertOne()` with `{ document }`
  - `insertMany` - Fired after `insertMany()` with `{ documents, insertedCount }`
  - `update` - Fired after `updateOne()` with `{ filter, update, document, upserted }`
  - `updateMany` - Fired after `updateMany()` with `{ filter, update, matchedCount, modifiedCount }`
  - `replace` - Fired after `replaceOne()` with `{ filter, document }`
  - `delete` - Fired after `deleteOne()` with `{ filter, deleted }`
  - `deleteMany` - Fired after `deleteMany()` with `{ filter, deletedCount }`
  - `findOneAndDelete` - Fired after `findOneAndDelete()` with `{ filter, document }`
  - `findOneAndUpdate` - Fired after `findOneAndUpdate()` with `{ filter, update, document, upserted }`
  - `findOneAndReplace` - Fired after `findOneAndReplace()` with `{ filter, document, upserted }`
  - `drop` - Fired after `drop()` with `{ name }`
  - `error` - Fired on operation errors with `{ operation, error, context }`

- **Event API Methods** - Standard EventEmitter interface on collections:
  - `on(event, listener)` - Register event listener
  - `once(event, listener)` - Register one-time listener
  - `off(event, listener)` - Remove event listener
  - `removeAllListeners(event?)` - Remove all listeners
  - `listenerCount(event)` - Get listener count
  - `listeners(event)` - Get all listeners for event

- **New exported types**:
  - `InsertEvent<T>`, `InsertManyEvent<T>` - Insert event payloads
  - `UpdateEvent<T>`, `UpdateManyEvent<T>` - Update event payloads
  - `DeleteEvent<T>`, `DeleteManyEvent<T>` - Delete event payloads
  - `ReplaceEvent<T>` - Replace event payload
  - `FindOneAndDeleteEvent<T>`, `FindOneAndUpdateEvent<T>`, `FindOneAndReplaceEvent<T>` - Atomic operation payloads
  - `DropEvent`, `ErrorEvent` - Drop and error event payloads
  - `CollectionEventMap<T>` - Type map for all events
  - `CollectionEventName` - Union type of event names
  - `CollectionEventEmitter<T>` - Typed EventEmitter class

### Performance

- **Lazy initialization** - EventEmitter only created when first listener is registered
- **Zero overhead** - No performance impact when events are not used
- **Optimized emission** - Listener count checked before creating payload objects

### Resource Management

- Event listeners automatically cleaned up when collection is dropped
- Database `close()` cleans up all collection event listeners

## [0.4.0] - 2026-01-06

### Added

- **Operation Cancellation** - AbortSignal support for canceling long-running operations:
  ```typescript
  const controller = new AbortController()
  setTimeout(() => controller.abort(), 5000)
  
  const results = await users.find(
    { age: { $gte: 18 } },
    { signal: controller.signal }
  )
  
  // Or use AbortSignal.timeout()
  const results = await users.find({}, { signal: AbortSignal.timeout(5000) })
  ```

- **Automatic Retries** - Configurable retry logic for transient failures:
  ```typescript
  // Database-level configuration
  const db = new Strata({
    database: 'app.db',
    retry: { retries: 3, minTimeout: 100 }
  })
  
  // Collection-level configuration
  const users = db.collection('users', schema, {
    retry: { retries: 5, minTimeout: 50 }
  })
  
  // Operation-level configuration
  await users.insertOne(doc, { retry: { retries: 2 } })
  
  // Disable retries for specific operation
  await users.find({}, { retry: false })
  ```

- **New error type**: `AbortedError` - Thrown when operations are cancelled via AbortSignal
- **New retry types**: `RetryOptions`, `RetryContext` - Configure retry behavior with exponential backoff
- **Retry utilities**: `withRetry`, `defaultShouldRetry`, `mergeRetryOptions` - Exported for custom retry logic

### Changed

- All collection methods now accept `signal?: AbortSignal` option for cancellation
- All collection methods now accept `retry?: RetryOptions | false` option for retry configuration
- Retry configuration follows precedence: operation > collection > database

## [0.3.2] - 2025-11-23

### Added

- **Type-safe projections** - `select` and `omit` options now narrow the TypeScript return type:
  ```typescript
  // TypeScript knows this returns Pick<User, '_id' | 'name' | 'email'>[]
  const users = await collection.find(
    { status: 'active' },
    { select: ['name', 'email'] as const }
  )
  users[0].name      // ✅ TypeScript knows this exists
  users[0].password  // ❌ TypeScript error: Property 'password' does not exist

  // With omit, TypeScript returns Omit<User, 'password'>[]
  const safeUsers = await collection.find(
    { status: 'active' },
    { omit: ['password'] as const }
  )
  ```

- **New exported types for type-safe projections**:
  - `QueryOptionsBase<T>` - Base query options without projection
  - `QueryOptionsWithSelect<T, K>` - Query options with select projection
  - `QueryOptionsWithOmit<T, K>` - Query options with omit projection
  - `QueryOptionsWithoutProjection<T>` - Query options explicitly without projection
  - `ProjectedDocument<T, K>` - Helper type for projected document results

### Notes

- Use `as const` with select/omit arrays for best type inference
- Method overloads added for `find()`, `findOne()`, and `search()` to support type-safe projections
- Comprehensive type tests added for projection type safety

## [0.3.1] - 2024-11-23

### Fixed

- Build now uses tsdown to bundle into single file instead of tsc multi-file output
- Package exports updated to use bundled .mjs files

## [0.3.0] - 2024-11-23

### Added

- **Dedicated `search()` method** - Clean API for text search across multiple fields:
  ```typescript
  const results = await collection.search('typescript', ['title', 'content'])
  ```

- **String operators** - New query operators for flexible string matching:
  - `$ilike` - Case-insensitive LIKE matching
  - `$contains` - Substring matching (shorthand for `$like: '%value%'`)

- **Field projection helpers** - Cleaner alternatives to `projection`:
  - `select` - Include only specified fields: `{ select: ['name', 'email'] }`
  - `omit` - Exclude specified fields: `{ omit: ['password'] }`

- **Text search option** - Multi-field text search via `find()`:
  ```typescript
  await collection.find({}, {
    search: { text: 'query', fields: ['title', 'content'] }
  })
  ```

- **Cursor pagination** - Efficient pagination for large datasets:
  ```typescript
  const page1 = await collection.find({}, { sort: { createdAt: -1 }, limit: 20 })
  const page2 = await collection.find({}, {
    sort: { createdAt: -1 },
    limit: 20,
    cursor: { after: page1.at(-1)?._id }
  })
  ```

- **New exported types**:
  - `SelectSpec<T>` - Type for select field arrays
  - `OmitSpec<T>` - Type for omit field arrays
  - `TextSearchSpec<T>` - Type for search configuration
  - `CursorSpec` - Type for cursor pagination

### Notes

- All changes are backward compatible
- Existing `projection` option continues to work alongside new `select`/`omit` helpers
- The `search` option in `find()` remains available for complex queries requiring filters

const UserError = errorSet<User>({
  name: "UserError", 
  kinds: ["not_found", "suspended"] as const,
})
