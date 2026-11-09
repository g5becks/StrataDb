# StrataDB

A type-safe **embedded document database** for Bun. No separate server process, no network overhead - just import and use.

## Why Embedded?

Unlike MongoDB or other client-server databases, StrataDB runs **in-process** with your application:

- **Zero setup** - No database server to install or manage
- **Zero latency** - Direct memory access, no network round-trips
- **Single file** - Your entire database is one portable `.db` file
- **Serverless ready** - Perfect for edge functions, CLI tools, and desktop apps

## Features

- **Embedded SQLite** - Runs in-process via `bun:sqlite`, no external dependencies
- **Full Type Safety** - Compile-time validation of queries, schemas, and results
- **MongoDB-like API** - Familiar operators: `$eq`, `$gt`, `$in`, `$and`, `$or`, etc.
- **JSONB Storage** - Flexible documents with indexed generated columns
- **Portable** - Single file database, easy to backup and deploy
- **Text Search** - Multi-field search with case-insensitive matching
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
const safe = await users.find({}, { omit: ['password'] })
```

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

Configure retry behavior at database, collection, or operation level:

```typescript
// Database-level: applies to all collections
const db = new Strata({
  database: 'app.db',
  retry: {
    retries: 3,
    minTimeout: 100,
    maxRetryTime: 5000
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

```typescript
const users = db.collection('users', schema)

// Listen for inserts
users.on('insert', (event) => {
  console.log('New user:', event.document._id)
  auditLog.record('user.created', event.document)
})

// Listen for updates
users.on('update', (event) => {
  if (event.document) {
    cache.invalidate(`user:${event.document._id}`)
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
users.off('insert', myListener)
users.removeAllListeners('update')
```

Available events: `insert`, `insertMany`, `update`, `updateMany`, `replace`, `delete`, `deleteMany`, `findOneAndDelete`, `findOneAndUpdate`, `findOneAndReplace`, `drop`, `error`

## Type Safety

TypeScript validates schema types against field definitions:

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
