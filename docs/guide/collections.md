# Collections

## Read-only databases

```typescript
const db = new Strata({ database: 'reference.db', readonly: true })
const users = db.collection('users', userSchema)
const results = await users.find({ active: true })
```

The file must already exist. Bun receives `readonly: true` without `create`.
Collection creation runs no DDL: required storage and declared indexed columns
must already exist, or setup throws `SchemaValidationError`. Open writable with
the desired schema first when migration is needed. Existing schema drift follows
the configured `onSchemaDrift` policy.

Reads, `execute()` read callbacks and manual read transactions work normally.
Every document write and `drop()` rejects with `DatabaseError`, the message
`database is read-only`, and SQLite code 8. Default retries stop after one attempt;
custom retry predicates remain authoritative. No write events are emitted.

For an existing Bun `Database`, also pass `readonly: true` to Strata. The library
policy is shared by wrappers of that connection; use a separate connection for
writable work. Opening the supplied connection physically read-only remains the
caller's responsibility. Direct `sqliteDb` access retains Bun's native behavior.

Collections store and query documents. Each collection maps to a SQLite table.

## Creating Collections

```typescript
import { Strata, createSchema, type Document } from 'stratadb'

type User = Document<{
  name: string
  email: string
  age: number
}>

// Option 1: Separate schema
const userSchema = createSchema<User>()
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .field('age', { type: 'INTEGER', indexed: true })
  .build()

const db = new Strata({ database: 'app.db' })
const users = db.collection('users', userSchema)

// Option 2: Inline schema
const users = db.collection<User>('users')
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .field('age', { type: 'INTEGER', indexed: true })
  .build()
```

## Insert Operations

```typescript
// Insert one - returns the inserted document
const user = await users.insertOne({
  name: 'Alice',
  email: 'alice@example.com',
  age: 30
})
console.log(user._id)  // auto-generated UUID

// Insert many - returns { documents, insertedCount }
const result = await users.insertMany([
  { name: 'Bob', email: 'bob@example.com', age: 25 },
  { name: 'Carol', email: 'carol@example.com', age: 35 }
])
console.log(result.insertedCount)  // 2
```

## Read Operations

```typescript
// Find by ID
const user = await users.findById('uuid-here')

// Find one by filter (also accepts string ID)
const admin = await users.findOne({ role: 'admin' })
const user = await users.findOne('uuid-here')

// Find many with options
const results = await users.find(
  { age: { $gte: 18 } },
  { sort: { age: -1 }, limit: 10 }
)

// Count matching documents
const count = await users.count({ status: 'active' })

// Search across multiple fields
const results = await users.search('alice', ['name', 'email'])
const filtered = await users.search('admin', ['role', 'notes'], {
  filter: { status: 'active' },
  sort: { createdAt: -1 },
  limit: 10
})

// Get distinct values for a field
const ages = await users.distinct('age')
const roles = await users.distinct('role', { status: 'active' })

// Fast approximate count (uses SQLite stats)
const approxCount = await users.estimatedDocumentCount()
```

## Update Operations

```typescript
// Partial update - merges with existing document
const updated = await users.updateOne('uuid-here', { age: 31 })

// Update by filter
await users.updateOne({ email: 'alice@example.com' }, { verified: true })

// Upsert - create if not found
await users.updateOne(
  { email: 'new@example.com' },
  { name: 'New User', age: 25 },
  { upsert: true }
)

// Update many - returns { matchedCount, modifiedCount }
const result = await users.updateMany(
  { status: 'inactive' },
  { status: 'archived' }
)

// Replace entire document (preserves _id and createdAt)
await users.replaceOne('uuid-here', {
  name: 'Alice Smith',
  email: 'alice.smith@example.com',
  age: 31
})
```

## Delete Operations

```typescript
// Delete one - returns true if deleted
const deleted = await users.deleteOne('uuid-here')
const deleted = await users.deleteOne({ email: 'old@example.com' })

// Delete many - returns { deletedCount }
const result = await users.deleteMany({ status: 'archived' })
```

## Atomic Operations

These methods find and modify a document in a single operation, returning the document:

```typescript
// Find and delete - returns the deleted document
const deleted = await users.findOneAndDelete({ status: 'expired' })
if (deleted) {
  console.log(`Removed user: ${deleted.name}`)
}

// Find and update - returns document before or after update
const updated = await users.findOneAndUpdate(
  { email: 'alice@example.com' },
  { loginCount: 5 },
  { returnDocument: 'after' }  // 'before' | 'after' (default: 'after')
)

// Find and replace
const replaced = await users.findOneAndReplace(
  { email: 'old@example.com' },
  { name: 'New Name', email: 'new@example.com', age: 30 },
  { returnDocument: 'after', upsert: true }
)
```

Use atomic operations when you need the document's state, such as for logging, undo functionality, or optimistic concurrency.

## Drop Collection

```typescript
// Permanently delete the collection and all documents
await users.drop()
```

## Error Handling

```typescript
import { UniqueConstraintError, ValidationError, AbortedError } from 'stratadb'

try {
  await users.insertOne(
    { email: 'duplicate@example.com' },
    { signal: AbortSignal.timeout(5000) }
  )
} catch (err) {
  if (err instanceof UniqueConstraintError) {
    console.error(`Duplicate value for ${err.field}`)
  }
  if (err instanceof ValidationError) {
    console.error(`Invalid document: ${err.message}`)
  }
  if (err instanceof AbortedError) {
    console.error('Operation timed out or was cancelled')
  }
}
```

## Cancellation and Retries

All collection methods support cancellation and automatic retries (v0.4.0+).

### Cancellation

```typescript
// Cancel with timeout
const results = await users.find(
  { age: { $gte: 18 } },
  { signal: AbortSignal.timeout(5000) }
)

// Cancel with AbortController
const controller = new AbortController()
setTimeout(() => controller.abort(), 5000)

await users.insertOne(doc, { signal: controller.signal })
```

### Collection-Level Retries

```typescript
// Configure retries for a collection
const users = db.collection('users', userSchema, {
  retry: {
    retries: 3,
    minTimeout: 100,
    maxTimeout: 5000
  }
})

// All operations on this collection will use these retry settings
await users.insertOne(doc)
await users.find({})
```

### Operation-Level Retries

```typescript
// Override retry settings for a specific operation
await users.insertOne(criticalDoc, {
  retry: { retries: 5, minTimeout: 50 }
})

// Disable retries for a specific operation
await users.find({}, { retry: false })
```

See [Retries & Cancellation](/guide/retries-and-cancellation) for complete documentation.

## Events

Collections emit events when documents are created, updated, or deleted. This enables reactive patterns like audit logging, cache invalidation, and real-time notifications.

```typescript
// Listen for insert events
users.on('insert', (event) => {
  console.log('New user:', event.document._id)
})

// Listen for update events
users.on('update', (event) => {
  console.log('User updated:', event.document?.name)
})

// Listen for delete events
users.on('delete', (event) => {
  console.log('User deleted:', event.deleted)
})

// Remove listeners when done
users.off('insert', listener)
users.removeAllListeners()
```

See the [Events Guide](/guide/events) for complete documentation on all available events, event payloads, and advanced patterns.

## Validation

```typescript
// Validate without inserting
try {
  const validUser = await users.validate(unknownData)
  // validUser is typed as User
} catch (err) {
  // ValidationError thrown if invalid
}

// Synchronous validation
const validUser = users.validateSync(unknownData)
```

## Connection lifecycle and row counts

After `db.close()`, asynchronous collection database operations and `validate()`
reject with `ConnectionError` saying the database is closed. `validateSync()` and
attempts to create a collection or transaction throw the same error. This applies
to both schema-created and fluent-builder collections. Repeated `close()` calls
are safe. Event listener registration and inspection keep their synchronous API.

On Bun 1.4.4 and newer, SQLite's `changes` count includes only rows changed by the
statement itself. Rows changed by user-added triggers or foreign-key cascades do
not inflate `deleteOne()`/`deleteMany()` results. Older Bun versions can include
those indirect changes; StrataDB does not create triggers or foreign-key cascades.
