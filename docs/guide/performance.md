# Performance Optimization

StrataDB provides several features to optimize query performance. This guide covers query caching, benchmarking, and performance best practices.

## Prepared statements

Collections cache up to 64 prepared statements by default. Set a positive integer
`statementCacheSize` on the database or override it in collection options. Each
collection owns its LRU; StrataDB does not change Bun's global query-cache limit.
Eviction, schema DDL, drop and close finalize native statements. A committed drop
also invalidates the collection factory entry; a rollback preserves it.

The optional `enableCache` setting controls a separate translator template cache.
It remains opt-in: with the statement cache, the recorded 50k indexed-read test
still improved from 1.38 to 1.12 µs/op when translator caching was enabled.
The same test measured 7.40/7.13 µs/op on v0.6.0 (translator off/on), on macOS
arm64 with Bun 1.4.4 and SQLite 3.54.0. These measurements describe that fixture
and host; reproduce them with:

```bash
bun bench/statement-cache.bench.ts /path/to/v0.6.0/worktree
bun bench/statement-cache.bench.ts
```

The script checks the result row, warms up 5,000 calls, and records five trials
of 50,000 awaited indexed `findOne` calls for each translator-cache setting.

## Query Caching

Query caching stores SQL templates for queries with the same structure, significantly improving performance for repeated query patterns.

### How It Works

When caching is enabled, StrataDB:

1. **Analyzes query structure** - Generates a cache key based on query operators and field names
2. **Caches SQL template** - Stores the generated SQL and parameter extraction paths
3. **Reuses templates** - On subsequent queries with the same structure, skips SQL generation
4. **Extracts values only** - Only parameter values are extracted, SQL is reused from cache

### Performance Benefits

With cache enabled, repeated queries show significant improvements:

| Query Type | Improvement |
|------------|-------------|
| Simple equality queries | ~23% faster |
| Range queries ($gte, $lt) | ~70% faster |
| Complex nested queries | ~55% faster |

### Memory Considerations

- **Cache size**: Up to 500 query templates per collection
- **FIFO eviction**: Oldest entries are evicted when cache is full
- **Memory usage**: Each entry stores SQL string and value extraction paths (~1-2KB per entry)

### Enabling Cache

Cache is **disabled by default**. You can enable it at the database or collection level.

#### Database-Level (Global Default)

Enable caching for all collections:

```typescript
const db = new Strata({
  database: 'app.db',
  enableCache: true  // Enable for all collections
})

const users = db.collection('users', userSchema)
const posts = db.collection('posts', postSchema)
// Both collections have caching enabled
```

#### Collection-Level (Override)

Enable caching for specific collections:

```typescript
// Database default: disabled
const db = new Strata({ database: 'app.db' })

// Enable cache for high-traffic collection
const users = db.collection('users', userSchema, { enableCache: true })

// Keep cache disabled for low-traffic collection
const logs = db.collection('logs', logSchema)  // Uses default (disabled)
```

#### Using Collection Builder

Enable caching with fluent API:

```typescript
const users = db.collection<User>('users')
  .field('name', { type: 'TEXT', indexed: true })
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .cache(true)  // Enable cache via builder
  .build()
```

### When to Enable Caching

✅ **Good use cases for caching:**

- Collections with repeated query patterns (e.g., user lookups by email)
- High-throughput read operations
- API endpoints with consistent filters
- Performance-critical paths
- Stable query structures

❌ **Avoid caching for:**

- Log/audit collections with highly varied queries
- Ad-hoc analytics queries
- Low-frequency access collections
- Memory-constrained environments
- Collections with mostly unique query patterns

### Non-Cacheable Operators

Some operators bypass the cache due to complex value extraction:

- `$elemMatch` (nested array matching)
- `$index` (array index access)
- `$all` (array containment)

These operators still work correctly but require full translation on each call.

### Cache Management

Access cache information:

```typescript
const collection = db.collection('users', userSchema, { enableCache: true })

// Get current cache size
const translator = (collection as any).translator
console.log(`Cache size: ${translator.cacheSize}`)

// Clear cache (useful for testing or schema changes)
translator.clearCache()
```

## Indexing Best Practices

Proper indexing is crucial for query performance:

### Single-Field Indexes

Index fields used in `find()` queries:

```typescript
const schema = createSchema<User>()
  .field('email', { type: 'TEXT', indexed: true })  // ✅ Indexed for lookups
  .field('bio', { type: 'TEXT', indexed: false })   // ❌ Not queried often
  .build()
```

### Compound Indexes

For queries filtering on multiple fields:

```typescript
const schema = createSchema<Order>()
  .field('userId', { type: 'TEXT', indexed: true })
  .field('status', { type: 'TEXT', indexed: true })
  .compoundIndex('userStatus', ['userId', 'status'])  // ✅ Composite queries
  .build()

// This query benefits from the compound index
await orders.find({ userId: 'user123', status: 'pending' })
```

### Unique Indexes

Enforce uniqueness while enabling fast lookups:

```typescript
const schema = createSchema<User>()
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .build()
```

## Query Optimization Tips

### 1. Use Indexed Fields in Filters

```typescript
// ✅ Good - uses indexed field
await users.find({ email: 'alice@example.com' })

// ❌ Slower - non-indexed field
await users.find({ bio: { $like: '%developer%' } })
```

### 2. Limit Results Early

```typescript
// ✅ Good - limit reduces data transfer
await users.find({ age: { $gte: 18 } }, { limit: 100 })

// ❌ Wasteful - retrieves all matching documents
await users.find({ age: { $gte: 18 } })
```

### 3. Project Only Needed Fields

```typescript
// ✅ Good - reduces data transfer
await users.find(
  { age: { $gte: 18 } },
  { projection: { name: 1, email: 1 } }
)

// ❌ Retrieves all fields
await users.find({ age: { $gte: 18 } })
```

### 4. Use Transactions for Batch Operations

```typescript
// ✅ Good - single transaction
await db.execute(async (tx) => {
  const users = tx.collection('users', userSchema)
  for (const user of userData) {
    await users.insertOne(user)
  }
})

// ❌ Slower - separate transactions
for (const user of userData) {
  await users.insertOne(user)
}
```

## Benchmarking

StrataDB includes performance benchmarks to measure operation speed.

### Running Benchmarks

```bash
# Query translation benchmarks
bun run bench

# CRUD operation benchmarks
bun run bench:crud

# Batch operation benchmarks
bun run bench:batch

# Run all benchmarks
bun run bench:all
```

### Benchmark Results

Results are displayed with average, minimum, maximum, and percentile times:

```
benchmark                  avg (min … max) p75 / p99
simple equality           242.45 ns/iter  286.73 ns
complex nested query        2.01 µs/iter    2.15 µs
findById                    5.94 µs/iter    6.42 µs
insertOne                 201.23 µs/iter  215.50 µs
```

### Custom Benchmarks

Create your own benchmarks using [mitata](https://github.com/evanwashere/mitata):

```typescript
import { bench, group, run } from 'mitata'
import { Strata, createSchema, type Document } from 'stratadb'

type User = Document<{ name: string; email: string }>

const schema = createSchema<User>()
  .field('name', { type: 'TEXT', indexed: true })
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .build()

const db = new Strata({ database: ':memory:' })
const users = db.collection('users', schema)

// Populate test data
await users.insertMany(
  Array.from({ length: 10000 }, (_, i) => ({
    name: `User ${i}`,
    email: `user${i}@example.com`
  }))
)

group('User queries', () => {
  bench('find by email', () => {
    users.find({ email: 'user5000@example.com' })
  })

  bench('find by name', () => {
    users.find({ name: 'User 5000' })
  })
})

await run()
```

## Performance Monitoring

### Query Analysis

Monitor query performance in production:

```typescript
const startTime = performance.now()
const results = await users.find({ status: 'active' })
const duration = performance.now() - startTime

if (duration > 100) {
  console.warn(`Slow query: ${duration}ms`, { status: 'active' })
}
```

### Cache Hit Rate

Track cache effectiveness:

```typescript
const translator = (collection as any).translator
const initialSize = translator.cacheSize

// Execute queries
await collection.find({ name: 'Alice' })
await collection.find({ name: 'Bob' })
await collection.find({ age: { $gt: 18 } })

const finalSize = translator.cacheSize
const uniqueQueries = finalSize - initialSize
console.log(`Cache hits: ${3 - uniqueQueries}/3`)
```

## Best Practices Summary

1. **Enable caching** for collections with repeated query patterns
2. **Index strategically** - only fields used in queries
3. **Use compound indexes** for multi-field queries
4. **Limit result sets** to reduce data transfer
5. **Project selectively** to fetch only needed fields
6. **Batch operations** in transactions
7. **Monitor performance** and adjust indexes/cache settings
8. **Benchmark regularly** to track performance over time

## See Also

- [Queries](/guide/queries) - Query syntax and operators
- [Indexes](/guide/indexes) - Index types and configuration
- [Transactions](/guide/transactions) - Atomic operations
