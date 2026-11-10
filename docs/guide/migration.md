# Migration Guide

This guide helps you migrate from other databases to StrataDB.

## From StrataDB 0.7 to 0.8

### Convert documents to explicit JSON values

Version 0.8 rejects values that JSON.stringify previously changed silently.
Before writing, convert Map/Set and class data to plain objects or arrays;
replace non-finite numbers with an explicit application value. BigInt,
functions, symbols, undefined array elements (including holes) and circular
references reject with a `ValidationError` naming the offending path and type.
Object properties containing `undefined` are still omitted. Other classes can
provide `toJSON()` whose output must satisfy the same JSON rules. Documents
nested beyond 256 levels reject.

Date is always rejected. Convert it explicitly and update the document type:

```typescript
// Before: Date read back as string despite the declared Date type.
type Before = Document<{ observedAt: Date }>

// After: the declared type agrees with the stored and returned value.
type Reading = Document<{ observedAt: string }>
const readings = db.collection('readings', createSchema<Reading>().build())
await readings.insertOne({ observedAt: new Date().toISOString() })
// Alternatively use observedAt: number and new Date().getTime().
```

These rules apply to inserts, replacements, deep-merge updates and atomic
update operands. Invalid batches fail serialization before writing any rows.
Existing JSON data requires no storage migration; inspect application inputs
that previously depended on implicit conversions.

### Review broader case-insensitive filters

`$ilike` and search with `caseSensitive: false` now use NFC normalization followed
by JavaScript locale-independent lowercase. For example, `%émile%` now matches
`Émile`, `ÉMILE`, `émile` and canonically equivalent decomposed text. Greek and
Cyrillic case pairs also match. Review affected filters before bulk updates or
deletes. Use `$like` or search with `caseSensitive: true` for exact-case matching.

This policy does not remove accents or implement full Unicode case folding:
`ß` matches `ẞ`, not `ss`; Turkish `İ` lowercases to `i` plus combining dot, and
plain `i` and dotless `ı` remain distinct. ASCII behavior, wildcard escaping and
case-sensitive operations are preserved. Unicode matching uses a per-row
JavaScript UDF and costs more than the previous ASCII-only SQLite function;
see [query semantics](./mongodb-differences.md#unicode-text-matching).

## From MongoDB

If you're currently using MongoDB, StrataDB provides a familiar API with additional type safety benefits.

### Key Differences

| MongoDB | StrataDB | Notes |
|---------|----------|-------|
| `MongoClient` | `Strata` | Main database class |
| `collection.insertOne()` | `collection.insertOne()` | Same API |
| `collection.find()` | `collection.find()` | Same API with type safety |
| Schema validation | Schema definitions with types | Compile-time validation |
| ObjectId | UUID strings | Auto-generated IDs |
| Multiple server setup | Single file or in-memory | Simpler deployment |

### Migration Steps

1. **Install StrataDB**:
```bash
bun add stratadb
```

2. **Define your document types**:
```typescript
// MongoDB document
interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  age: number;
}

// StrataDB document
import type { Document } from 'stratadb'

type User = Document<{
  name: string
  email: string
  age: number
}>
```

3. **Create schemas with indexes**:
```typescript
// MongoDB: Schema defined in database
// StrataDB: Schema defined in code
import { createSchema } from 'stratadb'

const userSchema = createSchema<User>()
  .field('name', { type: 'TEXT', indexed: true })
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .field('age', { type: 'INTEGER', indexed: true })
  .build()
```

4. **Update database connection**:
```typescript
// ❌ MongoDB approach
import { MongoClient } from 'mongodb'

const client = new MongoClient('mongodb://localhost:27017')
const db = client.db('myapp')
const users = db.collection('users')

// ✅ StrataDB approach
import { Strata } from 'stratadb'

const db = new Strata({ database: 'myapp.db' })
const users = db.collection('users', userSchema)
```

5. **Update your operations** (API is similar):
```typescript
// MongoDB and StrataDB have similar APIs
await users.insertOne({ name: 'Alice', email: 'alice@example.com', age: 30 })
await users.find({ age: { $gte: 18 } })

// Note: StrataDB uses simpler APIs - operations work by ID, not filters
await users.updateOne('user-id-here', { name: 'Alice Smith' }) // Update by known ID
await users.deleteOne('user-id-here') // Delete by known ID
```

### Handling MongoDB-Specific Features

#### ObjectId to UUID Migration

MongoDB uses ObjectId by default, while StrataDB uses UUIDs. If you need to migrate existing ObjectId data:

```typescript
type User = Document<{
  originalId?: string  // Store old ObjectId for migration
  name: string
  email: string
}>

// When migrating existing data:
const migrateFromMongo = async () => {
  // Import from MongoDB (pseudo-code)
  const mongoUsers = await mongoUsersCollection.find({}).toArray()
  
  for (const mongoUser of mongoUsers) {
    await stratadbUsers.insertOne({
      originalId: mongoUser._id.toString(),  // Store old ID for reference
      name: mongoUser.name,
      email: mongoUser.email,
    })
  }
}
```

#### Aggregation Pipeline Differences

MongoDB has complex aggregation pipelines. StrataDB doesn't support the full pipeline, so you'll need to handle complex operations differently:

```typescript
// ❌ MongoDB aggregation
const result = await users.aggregate([
  { $match: { age: { $gte: 18 } } },
  { $group: { _id: '$status', count: { $sum: 1 } } }
]).toArray()

// ✅ StrataDB alternative - simpler queries + application logic
const adults = await users.find({ age: { $gte: 18 } })
const statusCounts = adults.reduce((acc, user) => {
  acc[user.status] = (acc[user.status] || 0) + 1
  return acc
}, {} as Record<string, number>)
```

#### Text Search Migration

MongoDB has built-in text search. For similar functionality in StrataDB:

```typescript
// MongoDB text search
const results = await users.find({ $text: { $search: 'search term' } })

// ✅ StrataDB alternative - use LIKE or regex with indexed fields
const userSchema = createSchema<User>()
  .field('name', { type: 'TEXT', indexed: true })
  .field('email', { type: 'TEXT', indexed: true })
  .build()

// Then search indexed fields
const results = await users.find({
  $or: [
    { name: { $like: '%search%' } },
    { email: { $like: '%search%' } }
  ]
})
```

## From Prisma/TypeORM

If you're using Prisma or TypeORM, the main difference is that StrataDB is document-oriented rather than relational.

### Migration Considerations

#### Schema Definition

```typescript
// Prisma schema.prisma
// model User {
//   id    Int     @id @default(autoincrement())
//   name  String
//   email String  @unique
//   posts Post[]
// }

// ✅ StrataDB approach
type User = Document<{
  name: string
  email: string
  posts?: Post[]  // Embed related data or use references
}>

const userSchema = createSchema<User>()
  .field('name', { type: 'TEXT', indexed: true })
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .build()
```

#### Relationship Handling

```typescript
// ❌ Relational approach with joins
const userWithPosts = await prisma.user.findUnique({
  where: { id: 1 },
  include: { posts: true }
})

// ✅ Document approach - either embed or reference
// Option 1: Embed documents
type UserWithPosts = Document<{
  name: string
  email: string
  posts: Post[]  // Embedded in same document
}>

// Option 2: Use references
type User = Document<{
  name: string
  email: string
  postIds: string[]  // References to other documents
}>
```

## From Raw SQLite

If you're currently using raw SQLite with JSON columns, StrataDB provides a structured approach.

### Benefits of Migrating from Raw SQLite

1. **Type Safety**: Compile-time validation of queries
2. **Simplified Schema Management**: Define indexes in code instead of SQL
3. **MongoDB-like API**: Familiar interface for document operations
4. **Built-in Validation**: Schema validation without extra code

### Migration Steps

1. **Analyze your current table structure**:
```sql
-- Current raw SQLite table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL  -- JSON data
);
```

2. **Define StrataDB schemas**:
```typescript
type UserData = {
  name: string
  email: string
  age: number
  metadata: Record<string, unknown>
}

type User = Document<UserData>

const userSchema = createSchema<User>()
  .field('name', { type: 'TEXT', indexed: true })
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .field('age', { type: 'INTEGER', indexed: true })
  .build()
```

3. **Migrate existing data**:
```typescript
// Migration script
const migrateData = async () => {
  // Read from old table
  const oldUsers = db.prepare('SELECT id, data FROM users').all()
  
  for (const oldUser of oldUsers) {
    const userData = JSON.parse(oldUser.data) as UserData
    
    // Insert into new StrataDB collection
    await users.insertOne({
      id: oldUser.id,  // Preserve existing IDs
      ...userData
    })
  }
}
```

4. **Update your queries**:
```typescript
// ❌ Raw SQLite with manual JSON extraction
const stmt = db.prepare(`
  SELECT * FROM users 
  WHERE json_extract(data, '$.age') >= ? 
  AND json_extract(data, '$.status') = ?
`)

// ✅ StrataDB with type safety
const adults = await users.find({ 
  age: { $gte: 18 },
  status: 'active'
})
```

## From Other Document Databases

### Firebase/Firestore Migration

```typescript
// ❌ Firebase approach
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore'

const usersRef = collection(db, 'users')
const userDoc = await addDoc(usersRef, { name: 'Alice', email: 'alice@example.com' })
const adultUsers = await getDocs(query(usersRef, where('age', '>=', 18)))

// ✅ StrataDB approach
const result = await users.insertOne({ name: 'Alice', email: 'alice@example.com', age: 30 })
const adultUsers = await users.find({ age: { $gte: 18 } })
```

### CouchDB/PouchDB Migration

StrataDB doesn't support replication features, so consider this if you rely on synchronization.

## Migration Checklist

- [ ] Update project dependencies (replace old database with StrataDB)
- [ ] Define TypeScript document types
- [ ] Create schema definitions with appropriate indexes
- [ ] Plan data migration strategy
- [ ] Update connection/setup code
- [ ] Convert queries to StrataDB syntax (should be similar)
- [ ] Implement any custom validation logic
- [ ] Update deployment configuration (no separate database server)
- [ ] Test all CRUD operations with new type safety
- [ ] Profile performance to optimize indexes
- [ ] Update error handling patterns

## Handling Common Migration Challenges

### Complex Queries

If you have complex SQL-like queries, you may need to handle additional processing in application code:

```typescript
// For operations that require complex aggregation
const complexResults = async (minAge: number, minOrderCount: number) => {
  // Find users with criteria
  const users = await db.collection('users', userSchema).find({ age: { $gte: minAge } })
  
  // Apply additional filters in application code
  const results = []
  for (const user of users) {
    const orderCount = await db.collection('orders', orderSchema)
      .count({ userId: user.id })
      
    if (orderCount >= minOrderCount) {
      results.push(user)
    }
  }
  
  return results
}
```

### Database File Management

Unlike MongoDB which runs as a separate service, StrataDB uses files:

```typescript
// For production deployment
const db = new Strata({
  database: process.env.NODE_ENV === 'production' 
    ? '/var/lib/myapp/database.db'  // Production path
    : './dev.db'                   // Development path
})
```

### Backup Strategy

Since StrataDB uses a SQLite file, backups are simpler:

```bash
# Simple file backup
cp myapp.db myapp.db.backup.$(date +%Y%m%d)

# Or use SQLite's built-in backup command
sqlite3 myapp.db ".backup myapp.db.backup"
```

By following this guide, you should be able to migrate your existing database to StrataDB while gaining type safety and simpler deployment.