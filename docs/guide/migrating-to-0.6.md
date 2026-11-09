# Migrating to 0.6

StrataDB 0.6 makes query validation, concurrency and event delivery explicit. Upgrade the runtime first, review bulk-write filters, then run your application's tests against a copy of its database.

## Runtime and Types

```bash
# Before: applications could use Bun 1.3.14.
# After: install Bun 1.4.4 or newer, then verify it:
bun --version
bun add stratadb@^0.6.0
```

SQLite 3.45.0 or newer remains required. On macOS, configure `Database.setCustomSQLite()` before opening connections if the system engine is older. The package remains ESM with `dist/index.mjs` and `dist/index.d.mts`; source and consumer types are checked with TypeScript 5.9, 6.0 and 7.0. Include `"types": ["bun"]` in your application's TypeScript configuration.

## Promise Failures

Promise-returning methods always reject, including when retries are disabled. Constructors, `collection()`, `transaction()` and `validateSync()` retain synchronous error delivery.

```typescript
// Before: some failures escaped synchronously from a Promise API.
try {
  users.insertOne(input)
} catch (error) {
  handleError(error)
}

// After: await the operation or attach a rejection handler.
try {
  await users.insertOne(input)
} catch (error) {
  handleError(error)
}
```

## Strict Operators and Field Paths

Unknown operators raise `InvalidQueryOperatorError`. Malformed operands raise `QueryError` before SQL execution. An operator object must not be empty. Arrays are required for `$in`, `$nin` and `$all`; strings for LIKE and substring operators; a boolean for `$exists`; and a nonnegative safe integer for `$size`.

```typescript
// Before: this typo could remove the condition and match every row.
await users.deleteMany({ role: { $eqq: 'admin' } } as never)

// After: fix the operator; the typo now rejects without deleting rows.
await users.deleteMany({ role: { $eq: 'admin' } })
```

Field-path segments must start with a letter or underscore and contain only letters, digits and underscores. Rename punctuation-bearing document keys before querying them; dots separate nested segments. Collection names are quoted, so names such as `order` and `user-data` work. Empty or NUL-bearing collection names reject. Dotted indexed fields use distinct generated-column names; migrate any manually maintained generated columns before opening such a schema.

```typescript
// Before: unchecked strings could enter field or pagination SQL.
await records.find({ 'user-name': 'Ada' } as never, { limit: requestLimit as never })

// After: migrate the document key and validate numeric request options.
const limit = Number(requestLimit)
if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Invalid limit')
await records.find({ user_name: 'Ada' }, { limit })
```

`limit`, `skip` and `$index.index` require actual nonnegative safe integers. Numeric strings, negative numbers, fractions, infinity and NaN reject. `skip` without `limit` now works. Explicit `deleteMany({})` and `updateMany({})` remain supported.

## Null and Negative Filters

Null equality includes explicit null and missing fields. `$ne: null` selects non-null values. Non-null `$ne` and `$nin` exclusions include null and missing fields. A `null` member in `$nin` excludes both null and missing fields; `$nin: []` matches all documents.

```typescript
// Before: SQL NULL behavior silently excluded null/missing rows here.
await users.updateMany({ nick: { $nin: ['B'] } }, patch)

// After: retain a present, non-null-only restriction explicitly if required.
await users.updateMany({ nick: { $ne: null, $nin: ['B'] } }, patch)

// After: this matches explicit null and missing nick values.
await users.find({ nick: null })
```

See the [scalar semantics table](/guide/mongodb-differences#semantics-vs-mongodb-null-and-missing-scalar-fields) before migrating bulk writes. Stored `undefined` properties are omitted and count as missing; `undefined` filter operands reject.

## String Matching

`$like`, `$contains`, `$startsWith` and `$endsWith` are case-sensitive. The substring operators accept literal text, including `%`, `_` and backslash. `$like` and `$ilike` accept `%`/`_` patterns with backslash escaping; `$ilike` folds ASCII case. Default search also folds ASCII case and treats its text literally. Non-ASCII case folding is not provided by the default SQLite engine.

```typescript
// Before: $like also matched mixed/lower ASCII case.
await users.find({ name: { $like: 'ALICE' } })

// After: use $ilike to preserve that ASCII-insensitive intent.
await users.find({ name: { $ilike: 'ALICE' } })

// After: '_' is literal here, rather than a one-character wildcard.
await users.find({ name: { $startsWith: '_' } })
await users.search('ALICE', ['name'], { caseSensitive: true })
```

## Transactions and Atomic Mutations

Single-document updates, replacements, `findOneAnd*` operations and upserts select and write without an asynchronous gap. Conditional transitions have one winner. Independent field updates both persist; merge updates still deep-merge objects, replace arrays and retain explicit null values.

```typescript
// Before: batch methods needed a workaround outside execute().
await users.updateMany(filter, patch)
await logs.insertOne(logEntry)

// After: every write method can participate in one transaction.
await db.execute(async () => {
  await users.updateMany(filter, patch)
  await logs.insertOne(logEntry)
})
```

Nested calls use savepoints. Catch an inner error inside the outer callback to retain its earlier changes. Competing `execute()` calls run in call order; outside operations wait and cannot be rolled back by an unrelated callback. Create collections before concurrent work or inside the callback. Starting a synchronous collection or transaction from outside a pending `execute()` raises `TransactionError`.

Await every transaction operation. Await independent queued operations after the transaction completes. Complete manual handles in nesting order; commit/rollback/dispose are idempotent after completion. `transaction().collection()` now forwards collection options.

## Events and Listener Errors

Events are synchronous after the outermost commit, in registration order, at most once per registration/event. Rollback discards events. Savepoint commit defers delivery to the outer transaction.

```typescript
const delivered: string[] = []
users.on('insert', ({ document }) => delivered.push(document._id))

await db.execute(async () => {
  await users.insertOne(input)
  // Before: delivered already contained an event, even if this rolled back.
  // After: delivered is still empty until the outer commit.
})
// After: the committed insert's event has now been delivered.
```

A throwing listener never rejects or retries a committed write, and later listeners still run. Listen for `error` events to observe failures; otherwise StrataDB logs them. An error observer's own failure is logged without recursively emitting another error. Async listener rejections are observed, but writes do not await listener completion.

## Compound Indexes and Timestamps

Unique compound declarations now enforce their constraints. Remove existing duplicate tuples according to your application's rules before opening that schema. SQLite's standard NULL uniqueness behavior is retained.

```typescript
// Before: this declaration was stored as metadata but created no index.
const schema = createSchema<Entry>()
  .compoundIndex('account_external', ['accountId', 'externalId'], { unique: true })
  .build()

// After: opening this schema creates the unique index and rejects duplicates.
const entries = db.collection('entries', schema)
await entries.insertOne({ accountId: 'a', externalId: 'x' })
// Another identical tuple rejects with UniqueConstraintError.
```

Declare constituent fields indexed when full compound-key use in translated query plans is required. Otherwise compound indexes use validated JSON expressions.

```typescript
// Before: timestamps(false) was ignored.
// After: all returned/event documents omit createdAt and updatedAt.
const schema = createSchema<Entry>().timestamps(false).build()

// To retain public timestamp fields explicitly:
const timestampedSchema = createSchema<Entry>().timestamps(true).build()
```

Timestamp columns stay populated internally. `_id`, `createdAt` and `updatedAt` are removed from JSON bodies; reads hydrate metadata from columns, including existing databases.

## Error Handling and Retry Policy

Library SQLite failures are typed. Use `ConnectionError`, `QueryError`, `ConstraintError`, `UniqueConstraintError` and `DatabaseError` instead of depending on raw Bun errors. Wrapped errors retain `cause`, numeric `errno`, native `sqliteCodeName`, and operation/collection/SQL context. The library's `code` remains its own error identifier. Direct `sqliteDb` access remains Bun's native API.

```typescript
// Before: callers inspected a native SQLite error's string code.
if (error.code === 'SQLITE_BUSY') handleBusy()

// After: inspect a typed connection error and numeric SQLite errno.
if (error instanceof ConnectionError && error.errno !== undefined) {
  if (error.errno % 256 === 5) handleBusy()
}
```

Retries remain disabled until configured. Enabled retries now use `defaultShouldRetry` automatically, excluding validation, constraint and unknown errors. Existing custom predicates retain precedence.

```typescript
// Before: enabling retries without a predicate retried unknown errors too.
await withRetry(operation, { retries: 3 })

// After: the same options stop after the first unknown/validation failure.
await withRetry(operation, { retries: 3 })

// Add an explicit predicate for application-specific transient errors.
await withRetry(operation, {
  retries: 3,
  shouldRetry: (context) => defaultShouldRetry(context) ||
    context.error instanceof ApplicationTransientError,
})
```

See [retries and cancellation](/guide/retries-and-cancellation). Reserved `TypeMismatchError` and `TransactionAbortedError` exports remain available and are deprecated.
