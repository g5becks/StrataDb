# Troubleshooting

This guide helps you diagnose and resolve common issues with StrataDB.

## Common Installation Issues

### Bun Runtime Required

**Problem**: Error during installation or runtime that mentions bun:sqlite

**Solution**: StrataDB only works with Bun. Make sure you're using Bun and not Node.js:

```bash
# Check if you're using Bun
bun --version

# Install using Bun
bun add stratadb

# Run using Bun
bun run your-script.ts
```

### Module Resolution Issues

**Problem**: Cannot resolve imports like `bun:sqlite` or `stratadb`

**Solution**: Ensure you're running with Bun and using the correct import syntax:

```typescript
// ✅ Correct import
import { Strata, createSchema } from 'stratadb'
import type { Document } from 'stratadb'
```

## Database Connection Issues

### File Permission Errors

**Problem**: Error like "SQLITE_CANTOPEN: unable to open database file"

**Solutions**:
1. Check that the directory exists and is writable:
```bash
mkdir -p ./data
chmod 755 ./data
```

2. Use absolute paths if relative paths fail:
```typescript
const db = new Strata({
  database: '/absolute/path/to/your/app.db'
})
```

3. For temporary databases, use `:memory:`:
```typescript
const db = new Strata({ database: ':memory:' })
```

### Database Locked Errors

**Problem**: Error like "SQLITE_BUSY: database is locked"

**Solution**: This typically occurs with concurrent writes. Enable automatic retries to handle transient lock conflicts (v0.4.0+):

```typescript
// Database-level retry configuration
const db = new Strata({
  database: 'app.db',
  retry: {
    retries: 3,
    minTimeout: 100,
    maxTimeout: 2000
  }
})
```

StrataDB automatically retries on these SQLite error codes:
- `5` (SQLITE_BUSY) - Database is locked
- `6` (SQLITE_LOCKED) - Table is locked
- `7` (SQLITE_NOMEM) - Out of memory
- `10` (SQLITE_IOERR) - Disk I/O error

For critical operations, use more aggressive retry settings:

```typescript
await users.insertMany(criticalData, {
  retry: {
    retries: 5,
    minTimeout: 50,
    maxTimeout: 5000,
    onFailedAttempt: (ctx) => {
      console.log(`Database locked, retry ${ctx.attemptNumber}...`)
    }
  }
})
```

If retries don't help, use transactions to batch operations:

```typescript
await db.execute(async (tx) => {
  const users = tx.collection('users', userSchema)
  await users.insertOne(data1)
  await users.insertOne(data2)
})
```

### Operation Timeouts

**Problem**: Operations hang or take too long

**Solution**: Use AbortSignal to set timeouts (v0.4.0+):

```typescript
import { AbortedError } from 'stratadb'

// Simple timeout
const results = await users.find(
  { status: 'active' },
  { signal: AbortSignal.timeout(5000) }
)

// With error handling
try {
  const results = await users.find({}, { signal: AbortSignal.timeout(5000) })
} catch (error) {
  if (error instanceof AbortedError) {
    console.log('Query timed out after 5 seconds')
  }
  throw error
}

// Combine timeout with retries
const controller = new AbortController()
setTimeout(() => controller.abort(), 30000) // 30s overall timeout

await users.insertMany(largeDataset, {
  signal: controller.signal,
  retry: {
    retries: 5,
    minTimeout: 500
  }
})
```

## Schema and Query Issues

### Invalid Query Operator Errors

**Problem**: Error like "Query error with operator '$invalidOp': Operator not recognized"

**Solution**: Check the supported operators. Common mistakes:

```typescript
// ❌ Invalid - no $contains operator
await users.find({ tags: { $contains: 'admin' } })

// ✅ Correct - use $in for array inclusion
await users.find({ tags: { $in: ['admin'] } })

// ✅ For string contains, use $like with wildcards
await users.find({ name: { $like: '%admin%' } })
```

### Type Safety Issues

**Problem**: TypeScript errors with query filters

**Solution**: Ensure your schema field types match your query types:

```typescript
// ❌ Type mismatch - querying number field with string
type User = Document<{ age: number }>
await users.find({ age: 'thirty' }) // TypeScript error

// ✅ Correct - matching types
await users.find({ age: 30 })
await users.find({ age: { $gte: 18 } })
```

### Schema Path Validation

**Problem**: Field not found in query when using nested properties

**Solution**: Make sure your schema defines the indexed field with correct path:

```typescript
type User = Document<{
  profile: {
    bio: string
  }
}>

// ❌ This won't work for indexed queries on nested fields
const userSchema = createSchema<User>()
  .field('profile', { type: 'TEXT', indexed: true }) // Indexes the whole object

// ✅ Correct - specify the exact path for indexing
const userSchema = createSchema<User>()
  .field('profileBio', {
    path: '$.profile.bio', // Path to nested property
    type: 'TEXT',
    indexed: true
  })
  .build()

// Now this works:
await users.find({ 'profile.bio': 'software engineer' }) // Won't work with custom path
// Instead query what you indexed:
await users.find({ profileBio: 'software engineer' })
```

## Performance Issues

### Slow Query Performance

**Problem**: Queries are taking longer than expected

**Solutions**:

1. **Check indexing**: Ensure frequently queried fields are indexed:
```typescript
// ❌ Unindexed query - slow
const users = await users.find({ email: 'user@example.com' })

// ✅ Indexed query - fast
const userSchema = createSchema<User>()
  .field('email', { type: 'TEXT', indexed: true })
  .build()
```

2. **Use query caching** for repeated patterns:
```typescript
// Enable caching for frequently repeated queries
const db = new Strata({
  database: 'app.db',
  enableCache: true
})
```

3. **Optimize complex queries**:
```typescript
// ❌ Multiple OR conditions can be slow
await users.find({
  $or: [
    { status: 'active' },
    { status: 'pending' },
    { status: 'trial' }
  ]
})

// ✅ Single $in query is more efficient
await users.find({ status: { $in: ['active', 'pending', 'trial'] } })
```

### Memory Usage Issues

**Problem**: High memory usage with query caching enabled

**Solution**: Monitor and limit cache size:

```typescript
// Disable caching for collections with varied queries
const oneOffQueries = db.collection('temp', schema, { enableCache: false })

// Or limit the cache size by disabling global cache and enabling only where needed
const db = new Strata({
  database: 'app.db',
  enableCache: false  // Disable globally
})

const frequentlyUsed = db.collection('users', userSchema, { enableCache: true })
```

## Validation and Data Issues

### Unique Constraint Violations

**Problem**: `UniqueConstraintError` when inserting documents

**Solutions**:

1. **Check for duplicates before inserting**:
```typescript
const existing = await users.findOne({ email: newEmail })
if (!existing) {
  await users.insertOne(newUser)
}
```

2. **Use upsert operations**:
```typescript
await users.updateOne(
  { email: 'user@example.com' },  // Search criteria
  { name: 'Updated Name' },       // Update data
  { upsert: true }                // Insert if not found
)
```

3. **Handle the error gracefully**:
```typescript
try {
  await users.insertOne(newUser)
} catch (error) {
  if (error instanceof UniqueConstraintError) {
    if (error.field === 'email') {
      // Handle duplicate email
      throw new Error('Email already registered')
    }
  }
  throw error // Re-throw other errors
}
```

### Validation Errors

**Problem**: `ValidationError` when inserting documents

**Solutions**:

1. **Validate before insertion**:
```typescript
try {
  const validatedUser = userSchema.validate(userData)
  if (validatedUser) {
    await users.insertOne(userData)
  }
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(`Validation failed: ${error.message}`)
  }
}
```

2. **Debug validation issues**:
```typescript
// Use validateSync for synchronous validation
try {
  const validated = userSchema.validateSync(userData)
  await users.insertOne(validated)
} catch (error) {
  console.log('Validation error:', error)
  console.log('Problematic field:', error.field)
  console.log('Value that failed:', error.value)
}
```

## Transaction Issues

### Transaction Rollback Issues

**Problem**: Transaction doesn't rollback when expected

**Solution**: Make sure to properly handle errors in transactions:

```typescript
// ✅ Using execute helper (recommended)
const result = await db.execute(async (tx) => {
  const usersTx = tx.collection('users', userSchema)
  // If any operation throws, transaction automatically rolls back
  await usersTx.insertOne(userData)
  return { success: true }
})

// ✅ Manual transaction with proper error handling
using tx = db.transaction()
try {
  const users = tx.collection('users', userSchema)
  await users.insertOne(userData)
  await users.updateOne(someId, updateData)
  tx.commit()
} catch (error) {
  // tx.rollback() is called automatically by Symbol.dispose if not committed
  throw error
}
```

### Nested Transaction Issues

**Problem**: Issues with nested or concurrent transactions

**Solution**: Use nested `execute()` calls for savepoints, and await each transaction operation. Catch an inner failure inside the outer callback to keep its earlier writes. Competing callbacks and outside operations are serialized. Create collections before starting independent concurrent work.

```typescript
await db.execute(async () => {
  await users.insertOne(firstUser)
  try {
    await db.execute(async () => {
      await users.insertOne(secondUser)
      throw new Error('Roll back this savepoint')
    })
  } catch {
    // Only the second insert was rolled back.
  }
})
```

See [transaction ownership and nesting](/guide/transactions#nested-transactions-and-concurrent-work).

## Advanced Troubleshooting

### Debugging Slow Queries

Enable query logging to see the actual SQL being executed:

```typescript
// Add logging middleware (not built-in, but you can create one)
const originalFind = users.find
users.find = async function(...args) {
  console.time('find operation')
  const result = await originalFind.apply(this, args)
  console.timeEnd('find operation')
  return result
}
```

### Memory Leaks

If experiencing memory issues:

1. **Close databases properly**:
```typescript
// Use Symbol.dispose for automatic cleanup
using db = new Strata({ database: 'app.db' })
// db.close() called automatically when scope exits

// Or manually close
const db = new Strata({ database: 'app.db' })
// ... use db ...
db.close()
```

2. **Monitor collection instances** - avoid creating many collection instances:

```typescript
// ❌ Don't create collections repeatedly
function processUser(userId: string) {
  const users = db.collection('users', userSchema)  // New instance each time
  return users.findById(userId)
}

// ✅ Create collection once and reuse
const users = db.collection('users', userSchema)
function processUser(userId: string) {
  return users.findById(userId)  // Reuse same instance
}
```

### Testing Issues

**Problem**: Testing code that uses StrataDB

**Solution**: Use in-memory databases for tests:

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

describe('User Service', () => {
  let db: Strata
  let users: Collection<User>

  beforeEach(() => {
    // Use in-memory database for tests
    db = new Strata({ database: ':memory:' })
    users = db.collection('users', userSchema)
  })

  afterEach(() => {
    db.close()
  })

  test('should create user', async () => {
    const result = await users.insertOne(userData)
    expect(result.document.id).toBeDefined()
  })
})
```

## Getting Help

If you encounter issues not covered here:

1. **Check the API documentation** for method signatures and options
2. **Review the examples** in the guide documentation
3. **Search for similar issues** in the repository (if open source)
4. **Create a minimal reproduction** to isolate the problem

For debugging, consider creating a minimal example that reproduces your issue:

```typescript
// Example of a minimal reproduction
import { Strata, createSchema, type Document } from 'stratadb'

type TestDoc = Document<{ name: string }>

const schema = createSchema<TestDoc>()
  .field('name', { type: 'TEXT', indexed: true })
  .build()

const db = new Strata({ database: ':memory:' })
const collection = db.collection('test', schema)

try {
  await collection.insertOne({ name: 'test' })
  console.log('Success!')
} catch (error) {
  console.error('Error:', error)
} finally {
  db.close()
}
```