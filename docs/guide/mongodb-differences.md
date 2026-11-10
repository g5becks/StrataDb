# MongoDB Compatibility Guide

StrataDB provides a MongoDB-style API for developers familiar with MongoDB who want an embedded SQLite database. This guide defines its scalar semantics, shared operations, differences and migration considerations.

## Document values

Writes accept finite numbers, strings, booleans, null, arrays and plain objects (including null-prototype objects). Non-finite numbers, BigInt, Map, Set, functions, symbols, undefined array elements (including holes), circular references and class instances without `toJSON()` reject with `ValidationError` naming the path and type. Shared references without cycles are allowed. A depth guard rejects nesting beyond 256 levels. Object properties set to `undefined` are omitted.

`Date` is rejected even though it has `toJSON()`: convert it explicitly with `date.toISOString()` or `date.getTime()`, and declare the stored property as `string` or `number`. No Date-to-string conversion is hidden behind a Date return type. Other classes with `toJSON()` must return supported JSON values; the returned value is validated before storage.

## Semantics vs MongoDB: null and missing scalar fields

StrataDB matches explicit JSON `null` and missing fields with `{ nick: null }` or `{ nick: { $eq: null } }`. A document property set to `undefined` is omitted during serialization and therefore counts as missing. An `undefined` query operand is invalid and raises `QueryError`.

`$exists: true` matches every present field, including explicit JSON null. `$exists: false` matches only missing fields. These rules apply to indexed and dotted fields with query caching enabled or disabled.

`$ne: null` requires a present, non-null value. `$ne: 'B'` and `$nin: ['B']` include null and missing fields as well as other values. This follows the scalar null-query patterns described in [MongoDB's null-field reference](https://www.mongodb.com/docs/v7.0/tutorial/query-for-null-fields/).

| Stored `nick` | `nick: null` | `$ne: null` | `$ne: 'B'` / `$nin: ['B']` |
| --- | --- | --- | --- |
| Missing | Matches | No match | Matches |
| `null` | Matches | No match | Matches |
| `'A'` | No match | Matches | Matches |
| `'B'` | No match | Matches | No match |

For `$nin`, an empty exclusion list matches all documents. Including `null` in the list excludes both null and missing fields: `$nin: [null]` requires a non-null value, and `$nin: [null, 'B']` additionally excludes `'B'`. These are StrataDB's explicit scalar rules; MongoDB also documents array-specific membership behavior in its [`$nin` reference](https://www.mongodb.com/docs/manual/reference/operator/query/nin/).

`$in` includes null/missing scalar fields when its list contains null; an empty
list matches nothing. Empty `$and` and `$nor` match all documents, while empty
`$or` matches none. `$all: []` is vacuously true; a nonempty `$all` requires actual
array elements, including actual JSON null for a null operand. `$index` requires
an existing array element before applying its condition. Present null elements
count as existing; out-of-bounds indices never match, even for null, `$ne`, or
`$exists: false` conditions.

The same rules apply to indexed and unindexed fields and to read and write filters. Migrating from earlier StrataDB versions can therefore change the documents matched by bulk updates and deletes.

## Philosophy

StrataDB takes inspiration from MongoDB's developer-friendly API while embracing SQLite's simplicity and performance characteristics. The goal is to provide:

1. **Familiar API**: If you know MongoDB, you already know most of StrataDB
2. **Type Safety**: Full TypeScript support with compile-time guarantees
3. **Simplicity**: Simpler types, uniform patterns, no surprises
4. **Performance**: Leveraging SQLite's speed with smart indexing

## What's the Same

### Core CRUD Operations

All basic CRUD operations work exactly as you'd expect:

```typescript
// Find operations
await users.find({ age: { $gte: 18 } })
await users.findOne({ email: 'alice@example.com' })
await users.findById('user-123')

// Insert operations
await users.insertOne({ name: 'Alice', age: 30 })
await users.insertMany([{ name: 'Bob' }, { name: 'Charlie' }])

// Update operations
await users.updateOne({ _id: 'user-123' }, { age: 31 })
await users.updateMany({ status: 'inactive' }, { status: 'archived' })

// Delete operations
await users.deleteOne({ _id: 'user-123' })
await users.deleteMany({ status: 'archived' })
```

### Query Operators

StrataDB supports MongoDB's most common query operators:

```typescript
// Comparison operators
{ age: { $eq: 30 } }
{ age: { $ne: 30 } }
{ age: { $gt: 18, $lt: 65 } }
{ age: { $gte: 18, $lte: 65 } }
{ role: { $in: ['admin', 'moderator'] } }
{ role: { $nin: ['banned', 'deleted'] } }

// Logical operators
{ $and: [{ age: { $gte: 18 } }, { status: 'active' }] }
{ $or: [{ role: 'admin' }, { permissions: { $in: ['write'] } }] }
{ $not: { status: 'banned' } }

// Element operators
{ middleName: { $exists: true } }
{ deletedAt: { $exists: false } }
```

### Atomic Operations

All MongoDB atomic find-and-modify operations are supported:

```typescript
// Find and modify atomically
await users.findOneAndUpdate(
  { email: 'alice@example.com' },
  { loginCount: 5 },
  { returnDocument: 'after' }
)

await users.findOneAndReplace(
  { _id: 'user-123' },
  { name: 'Alice', email: 'alice@example.com', age: 31 }
)

await users.findOneAndDelete({ email: 'old@example.com' })
```

### Utility Methods

Common utility methods work the same way:

```typescript
// Count documents
await users.count({ status: 'active' })
await users.estimatedDocumentCount()

// Get distinct values
await users.distinct('role')
await users.distinct('age', { status: 'active' })

// Drop collection
await users.drop()
```

## Key Differences

### 1. Uniform Filter API

**StrataDB Enhancement**: All "One" methods accept either a string ID or a query filter for maximum flexibility.

```typescript
// MongoDB style - works in StrataDB
await users.findOne({ _id: 'user-123' })
await users.updateOne({ _id: 'user-123' }, { age: 31 })
await users.deleteOne({ _id: 'user-123' })

// StrataDB enhancement - string ID shorthand
await users.findOne('user-123')           // ✅ More convenient
await users.updateOne('user-123', { age: 31 })  // ✅ Cleaner
await users.deleteOne('user-123')         // ✅ Simpler

// Both work with query filters too
await users.findOne({ email: 'alice@example.com' })
await users.updateOne({ email: 'alice@example.com' }, { age: 31 })
```

### 2. Simpler Update Syntax

**StrataDB**: Uses direct partial updates without `$set` operator by default (though `$set` is supported for MongoDB compatibility).

```typescript
// MongoDB
await users.updateOne({ _id: 'user-123' }, { $set: { age: 31 } })

// StrataDB - simpler (recommended)
await users.updateOne('user-123', { age: 31 })

// StrataDB - also supports $set for compatibility
await users.updateOne('user-123', { $set: { age: 31 } })
```

### 3. Built-in Timestamps

**StrataDB**: Automatically manages `createdAt` and `updatedAt` timestamps for every document.

```typescript
// MongoDB - manual timestamp management
await users.insertOne({
  name: 'Alice',
  createdAt: new Date(),
  updatedAt: new Date()
})

// StrataDB - automatic
await users.insertOne({ name: 'Alice' })
// { _id: '...', name: 'Alice', createdAt: 1234567890, updatedAt: 1234567890 }
```

### 4. Schema-First Design

**StrataDB**: Requires explicit schema definition with type safety.

```typescript
// Define schema with indexed fields
const userSchema = createSchema<User>()
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .field('age', { type: 'INTEGER', indexed: true })
  .field('name', { type: 'TEXT', indexed: false })
  .build()

const users = db.collection('users', userSchema)
```

**Benefits**:
- Compile-time type checking
- Explicit index control
- Better query performance
- No schema migrations needed

### 5. TypeScript-First

**StrataDB**: Full TypeScript support with type inference throughout.

```typescript
type User = Document<{
  name: string
  email: string
  age: number
  active: boolean
}>

const user = await users.findOne('user-123')
// TypeScript knows: user is User | null
console.log(user?.name) // Type-safe access
```

## What's Not Supported

### Advanced MongoDB Features

StrataDB focuses on core document operations. The following MongoDB features are not supported:

#### 1. Aggregation Pipeline

```typescript
// ❌ Not supported
await users.aggregate([
  { $match: { age: { $gte: 18 } } },
  { $group: { _id: '$role', count: { $sum: 1 } } }
])

// ✅ Use SQL directly instead
const result = db.execute(`
  SELECT role, COUNT(*) as count
  FROM users
  WHERE age >= 18
  GROUP BY role
`)
```

#### 2. Geospatial Queries

```typescript
// ❌ Not supported
await places.find({
  location: {
    $near: {
      $geometry: { type: 'Point', coordinates: [-73.9667, 40.78] },
      $maxDistance: 1000
    }
  }
})

// ✅ Use SQLite spatial extensions if needed
```

#### 3. Text Search

```typescript
// ❌ Not supported
await articles.find({ $text: { $search: 'mongodb tutorial' } })

// ✅ Use $like for pattern matching
await articles.find({
  $or: [
    { title: { $like: '%mongodb%' } },
    { content: { $like: '%mongodb%' } }
  ]
})
```

#### 4. Transactions Across Collections

```typescript
// ❌ Not supported
const session = db.startSession()
session.startTransaction()
await users.insertOne({ name: 'Alice' }, { session })
await logs.insertOne({ action: 'user_created' }, { session })
await session.commitTransaction()

// ✅ Use database-level transactions
db.withTransaction(async (txDb) => {
  const users = txDb.collection('users', userSchema)
  const logs = txDb.collection('logs', logSchema)
  await users.insertOne({ name: 'Alice' })
  await logs.insertOne({ action: 'user_created' })
})
```

#### 5. Complex Array Operations

```typescript
// ❌ Not supported
await users.updateOne(
  { _id: 'user-123' },
  { $push: { tags: 'new-tag' } }
)

// ✅ Read, modify, write
const user = await users.findOne('user-123')
if (user) {
  await users.updateOne('user-123', {
    tags: [...user.tags, 'new-tag']
  })
}
```

## Migration from MongoDB

### 1. Connection Setup

```typescript
// MongoDB
import { MongoClient } from 'mongodb'
const client = new MongoClient('mongodb://localhost:27017')
await client.connect()
const db = client.db('myapp')

// StrataDB
import { StrataDB } from '@takinprofit/stratadb'
const db = new StrataDB({ database: './data/myapp.db' })
// Or in-memory: new StrataDB({ database: ':memory:' })
```

### 2. Define Schemas

```typescript
// MongoDB - schemaless (optional validation)
const users = db.collection('users')

// StrataDB - schema required
import { createSchema } from '@takinprofit/stratadb'

type User = Document<{
  name: string
  email: string
  age: number
}>

const userSchema = createSchema<User>()
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .field('age', { type: 'INTEGER', indexed: true })
  .build()

const users = db.collection('users', userSchema)
```

### 3. Update Queries

```typescript
// MongoDB
await users.updateOne(
  { _id: new ObjectId('...') },
  { $set: { age: 31 } }
)

// StrataDB - simpler
await users.updateOne('...', { age: 31 })
// Or with $set for compatibility
await users.updateOne('...', { $set: { age: 31 } })
```

### 4. Handle Timestamps

```typescript
// MongoDB - manual
await users.insertOne({
  name: 'Alice',
  createdAt: new Date(),
  updatedAt: new Date()
})

// StrataDB - automatic
await users.insertOne({ name: 'Alice' })
// Timestamps added automatically
```

### 5. Use String IDs

```typescript
// MongoDB
import { ObjectId } from 'mongodb'
const id = new ObjectId()

// StrataDB - simple strings
const id = 'user-123' // or use any ID generation you prefer
```

## Best Practices

### 1. Leverage String IDs

Use the string ID convenience methods when you have the ID:

```typescript
// Good - clean and simple
const user = await users.findOne(userId)
await users.updateOne(userId, { age: 31 })
await users.deleteOne(userId)

// Also fine - explicit filter
const user = await users.findOne({ _id: userId })
```

### 2. Index Frequently Queried Fields

```typescript
const userSchema = createSchema<User>()
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .field('age', { type: 'INTEGER', indexed: true })
  .field('bio', { type: 'TEXT', indexed: false }) // Don't index everything
  .build()
```

### 3. Use Atomic Operations

When you need both the old and new state:

```typescript
// Get state before update (for logging, etc.)
const before = await users.findOneAndUpdate(
  userId,
  { status: 'archived' },
  { returnDocument: 'before' }
)
await logStatusChange(before, 'archived')

// Get state after update (most common)
const after = await users.findOneAndUpdate(
  userId,
  { loginCount: user.loginCount + 1 },
  { returnDocument: 'after' }
)
```

### 4. Use Type Safety

```typescript
// Define types for compile-time safety
type User = Document<{
  name: string
  email: string
  age: number
}>

const user = await users.findOne(userId)
if (user) {
  console.log(user.name) // TypeScript knows the shape
  // console.log(user.invalid) // ❌ Compile error
}
```

## Summary

StrataDB provides a MongoDB-compatible API with these key improvements:

✅ **Uniform API**: String ID or filter everywhere  
✅ **Simpler Updates**: Direct partial updates (no `$set` required)  
✅ **Auto Timestamps**: Built-in `createdAt`/`updatedAt`  
✅ **Type Safety**: Full TypeScript support  
✅ **Schema-First**: Explicit control over indexing  

While some advanced MongoDB features aren't supported (aggregation pipeline, geospatial, text search), you get the simplicity of SQLite with a familiar MongoDB-like interface.

For most CRUD operations, StrataDB is a drop-in MongoDB replacement with better type safety and simpler patterns.
