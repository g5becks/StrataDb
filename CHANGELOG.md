# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking changes

- `execute()` calls and operations issued outside an active `execute()` now queue in call order. Await every transaction operation; outside writes survive a transaction rollback. Nested calls use savepoints, and events fire only after the outer commit (rolled-back events are discarded). Synchronous transaction/collection creation cannot join another caller's pending `execute()`; create collections beforehand or inside its callback. Transaction collection access now forwards collection options.

- Promise-returning collection operations always reject on failure, including when retries are disabled. Replace synchronous `try/catch` around calls with `await` inside `try/catch` or a `.catch()` handler. Synchronous APIs such as `validateSync()`, `collection()`, and `transaction()` retain synchronous errors.

- Unknown `$operators` now raise `InvalidQueryOperatorError` at every query nesting level. Malformed operator values and empty operator objects raise `QueryError` before SQL or cache lookup. Correct misspelled operators and supply arrays for `$in`/`$nin`/`$all`, strings for LIKE operators, a boolean for `$exists`, and a nonnegative integer for `$size`. Explicit empty-filter bulk operations (`deleteMany({})`, `updateMany({})`) remain supported.

- Query field paths now require identifier segments (`A-Z`, `a-z`, `_`, then letters, digits or `_`). Invalid filter, sort, search, distinct and schema paths raise `QueryError`; rename keys containing punctuation and use dotted paths for nested fields. Numeric `limit`, `skip` and `$index.index` must be nonnegative safe integers. JSON paths and numeric options are bound, and collection/index/column identifiers are quoted, preventing SQL injection. Collection names such as `order` and `user-data` now work; empty/NUL names are rejected. Dotted indexed fields use distinct generated-column names; reopen existing databases after migrating any manually created generated columns.

### Fixed

- Library SQLite failures now map by numeric `errno` to query, connection, unique/constraint or database errors. Wrapped errors preserve the native `cause`, `errno`, `sqliteCodeName`, and operation/collection/SQL context; the library `code` remains stable. Lock errors remain retryable. Reserved `TypeMismatchError` and `TransactionAbortedError` classes are deprecated and retained for compatibility. Direct access through `sqliteDb` remains Bun's native API.

- Listener failures are isolated per registration and reported through collection `error` observers, with console logging as the fallback. Later listeners still run, throwing `once()` listeners run once, async rejections are handled, and committed writes never fail or retry because of a listener. Events are synchronous after commit, in registration order, at most once per registration.

- Single-document updates, replacements, `findOneAnd*` operations and upserts now select and write inside a synchronous SQLite immediate transaction. Conditional transitions have one winner, independent concurrent updates persist, and concurrent matching upserts insert once. Deep merges still replace arrays and preserve explicit null values. Document metadata is stored in its dedicated columns and hydrated on reads; writes remove duplicate metadata from JSON bodies.

## [0.5.1] - 2026-11-09

### Added

- Linux/macOS quality-gate CI on pinned/latest Bun with immutable action references, frozen installs, coverage, and enabled pre-push tests. Installation only prepares Git hooks; docs deployment pins Bun.
- Isolated packed-tarball consumer checks with production dependencies, strict TS 6/7 declaration checks, a negative type assertion, and runtime CRUD verification.

### Changed

- Explicit Bun ambient types with pinned `@types/bun@1.4.4` and declared `@types/node@^26`, preserving listener introspection types under the newer Node declarations.
- Publish complete MIT/repository metadata, a `stratadb/package.json` export, and source files for working source-map navigation. The v0.5.1 package declares Bun `>=1.3.14`.
- API documentation regenerates in a private TypeScript 6 package. Remove this workaround when TypeDoc supports the TypeScript 7 compiler API.
- Type assertions now run directly against source with expect-type under every supported compiler, without a build or tsd's bundled compiler.
- Develop on TypeScript 7.0, with blocking TypeScript 5.9/6.0/7.0 compatibility checks and an advisory 7.1 beta CI check.
- Build with tsdown 0.23 and oxc isolated declarations, preserving `dist/index.mjs` and `dist/index.d.mts`. Public declarations inline type-fest so consumers do not need that development dependency.

### Fixed

- `$index` conditions validate SQLite bind values consistently and reject unsupported `Date`, `Map`, `Promise`, and undefined values with `QueryError`.
- Collection operations after `close()` report a typed `ConnectionError`, including fluent-builder collections; repeated close calls are safe. Documented Bun 1.4.4 direct-row `changes` counts.
- Opening a database checks SQLite `>=3.45.0` for JSONB and raises an actionable `ConnectionError` with the macOS `Database.setCustomSQLite()` remedy on older engines.
- Retry classification now reads SQLite's numeric `errno`, including extended BUSY/LOCKED/I/O codes, so `defaultShouldRetry` recognizes real lock failures.
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
