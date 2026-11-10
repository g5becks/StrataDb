# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.0] - 2026-11-10

### Breaking changes

- `$ilike` and case-insensitive text search now normalize strings to NFC and apply locale-independent Unicode lowercase, broadening matches for accents, Greek and Cyrillic (including canonically equivalent strings). ASCII and literal escaping stay the same. Review affected filters before bulk writes; use `$like` or `caseSensitive: true` when exact case is required. This is not full case folding: ß does not equal ss, and Turkish dotted/dotless i remain distinct as defined by JavaScript lowercase.

- Writes now reject non-JSON values with a path-aware `ValidationError`, preventing silent data loss from Map/Set, non-finite numbers, functions, symbols, undefined array elements and unsupported classes. Circular references and BigInt have specific diagnostics. Convert values to plain JSON before writing; object `undefined` properties remain omitted. Date is rejected: migrate to `date.toISOString()` with a `string` field or `date.getTime()` with a `number` field. Classes with `toJSON()` remain supported when their output is valid JSON. Nesting beyond 256 levels rejects.

### Added

- `bun run release:prepare <version>` prepares a hooked release commit, annotated tag, local CI verification, retained worktree, checked tarball, SHA-512 and release notes. `--dry-run` validates without writes. Publication remains a maintainer step.

## [0.7.0] - 2026-11-10

### Breaking changes

- Array query types now match runtime forms: replace numeric `$index: 0` with `$index: { index: 0, condition: valueOrOperators }`. Numeric shorthand already rejected at runtime and now also fails type checking. Scalar `$elemMatch` accepts typed number/string/array operators; object element filters retain typed field and dotted-path operands. Runtime validation and SQL are unchanged.

- Circular/non-serializable documents now reject with `ValidationError` instead of storing circular-reference markers. Batch inserts reject serialization failures before writing. Runtime dependencies are deepmerge-ts 8, p-retry 9 and Standard Schema 1.1; fast-safe-stringify was removed. Retry callback order is now `shouldConsumeRetry` → `onFailedAttempt` → `shouldRetry`, `RetryContext` includes `retryDelay`, and an aborted signal wins over attempt errors and suppresses remaining callbacks. Review custom retry callbacks and manually constructed contexts.

- Differential testing corrected query edge cases: empty `$or` matches nothing; `$in` lists containing null include null/missing scalar fields; `$all` can require actual null array elements; `$index` requires an existing array element and distinguishes present null from a missing index. Review bulk-write filters using these forms.

- Update APIs and event payloads use `DocumentUpdate<T>`, a union of plain deep merges and atomic operator forms, with immutable ID/timestamp metadata. Consumers inspecting `event.update` should narrow the operator form before reading plain fields. Mixed forms, overlapping paths and malformed operators reject with `QueryError`.

- Cached collection lookups reject schema mismatches with `SchemaValidationError`, including different validator function identities. Fluent collections now share cache identity and inherit database retries and the default enabled timestamps. Use the same schema/validator when reusing a name; opt out of timestamps explicitly with `.timestamps(false)` if required.

- Checked schema and collection-builder field declarations and compound-index fields accept only document string keys or dotted `DocumentPath` values. Correct misspellings; use `fieldUnchecked` and `compoundIndexUnchecked` for intentionally dynamic names. These explicit escapes still undergo runtime identifier validation.

- Cursor pagination rejects unknown/malformed IDs and requires a nonempty sort. Every sorted find appends ascending `_id` unless explicitly sorted, so tied rows have a stable order from the first page. `before` returns the nearest previous page in the requested order. Review clients that relied on invalid cursors returning the first page or on insertion order for ties.

- Logical `$not` and `$nor` treat an unknown (null/missing) comparison as false before negation, including inside `$elemMatch`. Review negated bulk-write filters that relied on SQL NULL dropping missing fields; add `$exists: true` when presence is required.

- Successful `update` event documents are now typed as non-null, and delete events discriminate `_id: string` on success from `_id: null` on a miss. Batch update/delete payloads require `ids`. Update manually constructed event fixtures accordingly. `deleteOne` now emits a miss event consistently for both ID and object filters.

### Added

- Named public option/context and contract types are available from the package root: `CollectionOptions`, `RetryableOptions`, `SQLiteErrorContext`, collection contract groups, `UpdatePath` and `ArrayValue`. Generated API pages document and link these signatures without TypeDoc validation warnings.

- `$regex` accepts a JavaScript Unicode regex string through a deterministic SQLite UDF registered once per connection. Invalid patterns reject with `QueryError`, including cache hits and empty tables. Matching is case-sensitive, applies to strings only and cannot use an index.

- Opt-in `onRawChange` observes SQLite row metadata for this connection, including raw SQL. It owns the connection's hooks exclusively, isolates observer exceptions and reports changes before commit (including later rollbacks). It does not replace commit-buffered collection events; see the events guide for hook limits.

- Each collection keeps a configurable prepared-statement LRU (64 entries by default) via database/collection `statementCacheSize`. Statements are finalized on eviction, DDL, drop and close; rolled-back drops preserve collection identity. Simple `findOne` calls use a direct single-row path while complex options retain the general query path. Reproducible 50k-read benchmarks show more than 5× lower latency than v0.6.0 on the recorded host; optional translator caching remains separately configurable.

- A 500-case seeded fast-check differential suite compares SQLite against an independent query evaluator, repeating and varying literals across indexed/unindexed and cached/uncached collections. A SHA-pinned nightly workflow prints a random replay seed; local replay instructions and minimized regressions are retained.

- `new Strata({ database: path, readonly: true })` opens an existing file with Bun's read-only flag alone. Collection setup validates stored columns without DDL; missing tables/indexed columns require a writable migration. All write APIs reject with nonretryable-by-default `DatabaseError` (`sqliteCode: 8`), while reads and read transactions remain available. The policy is connection-scoped for supplied Bun connections.

- Atomic `$set`, `$unset`, `$inc`, `$push` and `$pull` updates for single, find-and-update, batch and upsert APIs. Operator writes use one JSONB UPDATE per operation, preserving validation, transaction/event buffering and metadata. `$push` appends one value; `$pull` removes every structurally equal JSON value (object key order ignored, array order and JSON types preserved). Missing numeric/array fields initialize for increment/push; null or incompatible targets reject. Dotted scalar equality filters now seed nested upsert documents correctly.

- Cursor predicates compare all sort keys lexicographically, including nested fields and NULL/missing values (NULLS FIRST ascending, NULLS LAST descending). Seeded fast-check pagination walks verify forward/backward completeness against an independent reference comparator.

- `$elemMatch` supports object fields, dotted paths, nested field operators and arrays, and logical object filters. All conditions apply to the same element. Scalar forms remain supported, non-array input is ignored safely, and object filters skip non-object elements.

- Delete events identify the resolved row, with optional deleted-document snapshots through `deleteOne(filter, { includeDocument: true })`. Batch events include IDs from actual SQLite RETURNING rows; updates ignored by a trigger are excluded from IDs and modified counts. ID order follows SQLite RETURNING and is not guaranteed. Commit buffering and rollback suppression are preserved.

- Reopening a collection adds newly declared indexed fields as virtual generated columns and creates their indexes atomically. Existing rows become queryable through the new fields; affected indexes left by earlier failed evolution attempts are rebuilt. Bun's query cache is cleared after DDL. Removed or type-changed stored generated columns are retained and reported through `onSchemaDrift` (default console warning); set it to `"error"` to require an explicit migration.

### Fixed

- Repaired CRUD benchmark fixture lifetime and awaited setup/results while retaining every case. All benchmark runners now propagate errors instead of reporting a successful run with failed cases.

- `updateOne` now forwards operation-level retry overrides. `retry: false` suppresses inherited retries, and an explicit policy/predicate overrides defaults while retaining promise rejections and atomic failure behavior.

### Performance

- Inclusion projections (`select` and inclusion `projection`) construct only the requested JSON in SQLite. Literal property names, missing fields, JSON types and timestamp visibility are preserved; exclusion projections retain their JavaScript path. A 50-field/two-field benchmark improved from 9.99 to 8.46 µs/read (15% lower latency) on Bun 1.4.4, macOS arm64.

### Tooling

- Added a SHA-pinned weekly/manual benchmark workflow with environment metadata, strict query/CRUD/batch results and fixed-protocol JSON artifacts. CONTRIBUTING explains local reproduction and how to compare results while Actions is unavailable.

- Consolidated the current architecture in `docs/DESIGN.md`, archived historical proposals under `docs/design/`, removed duplicate root designs and refreshed AGENTS/Claude/Copilot guidance for current APIs and release verification.

- Split collection state/DDL/read/write logic, query caching/operators and public contracts into focused source modules. All source files remain below 600 lines. Event registration uses a typed facade, and collection complexity suppressions were removed without changing behavior.

- Updated Biome to 2.6.6, Ultracite to 8.1.1, commitlint to 21.2.4, validator test libraries and remaining development tools. Kept TypeScript 7.0.2 for development and TypeScript 6.0.3 for TypeDoc; 7.1 remains advisory beta. Lint configuration preserves meaningful object order, public type/method styles and sequential database operations.

## [0.6.0] - 2026-11-09

### Breaking changes

- Enabled retries now use `defaultShouldRetry` when no predicate is supplied. Validation, constraint, query and unknown errors stop after the first attempt; real transient SQLite lock failures still retry. Supply a custom `shouldRetry` for application-specific transient errors. Retries remain disabled until configured.

See [Migrating to 0.6](docs/guide/migrating-to-0.6.md) for before/after examples and the [semantics guide](docs/guide/mongodb-differences.md) for scalar query rules.

- StrataDB now requires Bun `>=1.4.4`. Upgrade the application runtime before upgrading StrataDB. CI and the local fallback verify the 1.4.4 floor and latest Bun, alongside TypeScript 5.9/6.0/7.0 compatibility.

- `$like`, `$contains`, `$startsWith` and `$endsWith` are case-sensitive. Substring/prefix/suffix and search text treat `%`, `_` and backslash literally. `$like`/`$ilike` retain `%`/`_` pattern wildcards with backslash escaping; `$ilike` and default search fold ASCII case only. Use `$ilike` or default search when ASCII-insensitive matching is required. `search({ caseSensitive: true })` now performs exact matching.

- Null equality now matches explicit null and missing fields. `$ne: null` requires a non-null value; `$ne: value` and non-null `$nin` lists include missing/null fields. A `null` entry in `$nin` excludes both null and missing values; an empty list matches all documents. Review bulk-write filters that previously relied on SQL NULL comparisons dropping rows. See the [scalar semantics table](docs/guide/mongodb-differences.md#semantics-vs-mongodb-null-and-missing-scalar-fields).

- Unique compound indexes are now enforced. Remove duplicate tuples before reopening an existing database with a unique compound index declaration that earlier versions ignored.

- `execute()` calls and operations issued outside an active `execute()` now queue in call order. Await every transaction operation; outside writes survive a transaction rollback. Nested calls use savepoints, and events fire only after the outer commit (rolled-back events are discarded). Synchronous transaction/collection creation cannot join another caller's pending `execute()`; create collections beforehand or inside its callback. Transaction collection access now forwards collection options.

- Promise-returning collection operations always reject on failure, including when retries are disabled. Replace synchronous `try/catch` around calls with `await` inside `try/catch` or a `.catch()` handler. Synchronous APIs such as `validateSync()`, `collection()`, and `transaction()` retain synchronous errors.

- Unknown `$operators` now raise `InvalidQueryOperatorError` at every query nesting level. Malformed operator values and empty operator objects raise `QueryError` before SQL or cache lookup. Correct misspelled operators and supply arrays for `$in`/`$nin`/`$all`, strings for LIKE operators, a boolean for `$exists`, and a nonnegative integer for `$size`. Explicit empty-filter bulk operations (`deleteMany({})`, `updateMany({})`) remain supported.

- Query field paths now require identifier segments (`A-Z`, `a-z`, `_`, then letters, digits or `_`). Invalid filter, sort, search, distinct and schema paths raise `QueryError`; rename keys containing punctuation and use dotted paths for nested fields. Numeric `limit`, `skip` and `$index.index` must be nonnegative safe integers. JSON paths and numeric options are bound, and collection/index/column identifiers are quoted, preventing SQL injection. Collection names such as `order` and `user-data` now work; empty/NUL names are rejected. Dotted indexed fields use distinct generated-column names; reopen existing databases after migrating any manually created generated columns.

### Added

- Tag-triggered release workflow with SHA-pinned actions, full verification, version/registry guards, npm OIDC trusted publishing and provenance. CONTRIBUTING.md documents the one-time setup and local/manual release fallback while Actions is unavailable.
- Audit regression and identifier-injection suites cover the v0.6.0 safety and correctness fixes.

### Fixed

- `$exists` distinguishes present JSON null from missing fields, handles string values without parsing errors, and preserves true/false semantics across cached queries. Indexed and nested fields use the same presence rules.

- `find()` supports `skip` without `limit`, including zero and past-end offsets, with a bound offset and SQLite's unlimited `LIMIT -1` form.

- `timestamps(false)` now omits `createdAt` and `updatedAt` from all returned documents and event payloads, including projections and upserts. Timestamp columns remain populated internally, and default/enabled timestamp behavior is preserved.

- Declared compound indexes are now created, including unique and nested-field indexes. Index names encode the collection/name pair to prevent collisions. Existing duplicate tuples must be cleaned before opening a schema that declares a unique compound index. Generated columns are used for indexed fields, validated JSON expressions otherwise; declare constituent fields indexed when query-plan use of the full compound key is required. SQLite's standard NULL uniqueness behavior is retained.

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
