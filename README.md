# StrataDB

A type-safe **embedded document database** for Bun. No separate server process, no network overhead - just import and use.

## Why Embedded?

Unlike MongoDB or other client-server databases, StrataDB runs **in-process** with your application:

- **Zero setup** - No database server to install or manage
- **Zero latency** - Direct memory access, no network round-trips
- **Single file** - Your entire database is one portable `.db` file
- **Serverless ready** - Perfect for edge functions, CLI tools, and desktop apps

## Features

- **Embedded SQLite** - Runs in-process via `bun:sqlite`, with no database server
- **Typed Queries** - Compile-time checks for query values, declared field types, and results
- **MongoDB-like API** - Familiar operators: `$eq`, `$gt`, `$in`, `$and`, `$or`, etc.
- **JSONB Storage** - Flexible documents with indexed generated columns
- **Portable** - Single file database, easy to backup and deploy
- **Text Search** - Literal multi-field search with ASCII case folding or exact case
- **Cursor Pagination** - Efficient, stable pagination for large datasets
- **Field Projection** - Clean `select`/`omit` helpers for controlling returned fields
- **Operation Cancellation** - AbortSignal support for canceling long-running operations
- **Automatic Retries** - Configurable retry logic for transient failures
- **Collection Events** - EventEmitter support for reactive document lifecycle events

## Installation

```bash
bun add stratadb
```

Requires [Bun](https://bun.com) **1.4.4 or newer**. StrataDB uses `bun:sqlite` and runs on Bun.

SQLite **3.45.0 or newer** is required for JSONB support. StrataDB checks the
engine version when opening a database and throws `ConnectionError` for older
engines. Bun uses the system SQLite on macOS; if it is too old, call
`Database.setCustomSQLite('/path/to/libsqlite3.dylib')` from `bun:sqlite` before
creating any database connections to load a newer library.

> **Note:** StrataDB is ESM-only. It does not provide CommonJS exports.

## Quick Start

```typescript
import { Strata, createSchema, type Document } from 'stratadb'

type User = Document<{
  name: string
  email: string
  age: number
}>

const schema = createSchema<User>()
  .field('name', { type: 'TEXT', indexed: true })
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .field('age', { type: 'INTEGER', indexed: true })
  .compoundIndex('name_age', ['name', 'age'])
  .timestamps(true)
  .build()

using db = new Strata({ database: 'app.db' })
const users = db.collection('users', schema)

// Insert
const user = await users.insertOne({
  name: 'Alice',
  email: 'alice@example.com',
  age: 30
})

// Query
const adults = await users.find({
  age: { $gte: 18 },
  email: { $endsWith: '@example.com' }
})

// Update
await users.updateOne(user._id, { age: 31 })

// Delete
await users.deleteOne(user._id)

// Text search across fields
const results = await users.search('alice', ['name', 'email'])

// Cursor pagination for large datasets
const page1 = await users.find({}, { sort: { createdAt: -1 }, limit: 20 })
const page2 = await users.find(
  {},
  { sort: { createdAt: -1 }, limit: 20, cursor: { after: page1.at(-1)?._id } }
)

// Field projection
const names = await users.find({}, { select: ['name', 'email'] })
const safe = await users.find({}, { omit: ['age'] })
```

Compound indexes are created in SQLite. Use `{ unique: true }` to enforce a unique tuple; remove existing duplicates before opening that schema. Declare constituent fields indexed when full compound-key query-plan use is required.

Timestamps are enabled by default. `.timestamps(false)` omits `createdAt` and `updatedAt` from returned documents and event documents; timestamp columns remain internal. Updates preserve deep-merge behavior, replace arrays, and keep explicit null values.

`$like`, `$contains`, `$startsWith` and `$endsWith` match case exactly. The latter three accept literal text. `$like` and `$ilike` accept `%`/`_` wildcards with backslash escaping; `$ilike` folds ASCII case. Search text is literal, with optional `caseSensitive: true`. See [query semantics](docs/guide/mongodb-differences.md) and [Migrating to 0.6](docs/guide/migrating-to-0.6.md).

## Operation Cancellation

Cancel long-running operations using AbortSignal:

```typescript
const controller = new AbortController()

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000)

try {
  const results = await users.find(
    { age: { $gte: 18 } },
    { signal: controller.signal }
  )
} catch (error) {
  if (error instanceof AbortedError) {
    console.log('Operation was cancelled')
  }
}

// Use AbortSignal.timeout() for automatic timeout
const results = await users.find(
  {},
  { signal: AbortSignal.timeout(5000) }
)
```

## Automatic Retries

Retries are disabled until configured. Configure retry behavior at database, collection, or operation level. The exported `defaultShouldRetry` policy recognizes transient SQLite `errno` values and excludes validation, constraint and unknown errors:

```typescript
import { defaultShouldRetry } from 'stratadb'

// Database-level: applies to all collections
const db = new Strata({
  database: 'app.db',
  retry: {
    retries: 3,
    minTimeout: 100,
    maxRetryTime: 5000,
    shouldRetry: defaultShouldRetry
  }
})

// Collection-level: overrides database settings
const users = db.collection('users', schema, {
  retry: {
    retries: 5,
    minTimeout: 50
  }
})

// Operation-level: overrides collection settings
await users.insertOne(
  { name: 'Alice', email: 'alice@example.com', age: 30 },
  { retry: { retries: 2, minTimeout: 10 } }
)

// Disable retries for specific operation
await users.find({}, { retry: false })

// Combine with AbortSignal
await users.find(
  {},
  {
    signal: AbortSignal.timeout(10000),
    retry: { retries: 3, minTimeout: 100 }
  }
)
```

## Collection Events

React to document changes with type-safe event listeners:

Events run synchronously after the outermost commit, in registration order, at most once per registration/event. Rollback discards buffered events. Throwing listeners and async rejections are reported to `error` observers (or logged) and never reject or retry a committed write; later listeners still run. Async listener completion is not awaited.

```typescript
const users = db.collection('users', schema)

// Listen for inserts
users.on('insert', (event) => {
  console.log('New user:', event.document._id)
})

// Listen for updates
users.on('update', (event) => {
  if (event.document) {
    console.log('Updated user:', event.document._id)
  }
})

// Listen for deletes
users.on('delete', (event) => {
  console.log('User deleted:', event.deleted)
})

// One-time listener
users.once('insert', (event) => {
  console.log('First user created!')
})

// Remove listeners
users.removeAllListeners('update')
users.removeAllListeners() // Clear every event

users.on('error', ({ operation, error }) => {
  console.error('Listener failed for', operation, error)
})
```

Available events: `insert`, `insertMany`, `update`, `updateMany`, `replace`, `delete`, `deleteMany`, `findOneAndDelete`, `findOneAndUpdate`, `findOneAndReplace`, `drop`, `error`

## Type Safety

TypeScript checks query values and declared SQL field types. Runtime query validation rejects unknown operators, malformed values and invalid field-path segments. In 0.6, schema field-name spelling still requires care: the builder accepts syntactically valid strings.

```typescript
// Correct - types match
db.collection<User>('users')
  .field('name', { type: 'TEXT' })      // string -> TEXT
  .field('age', { type: 'INTEGER' })    // number -> INTEGER
  .build()

// Compile error - type mismatch
db.collection<User>('users')
  .field('name', { type: 'INTEGER' })   // Error: string cannot use INTEGER
  .build()
```

## Documentation

- [Migrating to 0.6](docs/guide/migrating-to-0.6.md)
- [Semantics vs MongoDB](docs/guide/mongodb-differences.md)

See the [documentation](https://g5becks.github.io/StrataDb/) for complete guides:

- [Getting Started](https://g5becks.github.io/StrataDb/guide/getting-started)
- [Collections](https://g5becks.github.io/StrataDb/guide/collections)
- [Queries](https://g5becks.github.io/StrataDb/guide/queries)
- [Schemas](https://g5becks.github.io/StrataDb/guide/schemas)
- [Events](https://g5becks.github.io/StrataDb/guide/events)
- [Transactions](https://g5becks.github.io/StrataDb/guide/transactions)

## Development

```bash
bun install      # Install dependencies
bun test         # Run tests
bun run build    # Build
bun run typecheck # Type check
```

## License

MIT
