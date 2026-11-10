# Queries

StrataDB provides type-safe MongoDB-style query operators.

## Comparison Operators

```typescript
// Implicit equality
await users.find({ status: 'active' })

// Explicit operators
await users.find({ age: { $eq: 30 } })   // equal
await users.find({ age: { $ne: 30 } })   // not equal
await users.find({ age: { $gt: 18 } })   // greater than
await users.find({ age: { $gte: 18 } })  // greater than or equal
await users.find({ age: { $lt: 65 } })   // less than
await users.find({ age: { $lte: 65 } })  // less than or equal

// Range query (combine operators)
await users.find({ age: { $gte: 18, $lt: 65 } })

// Membership
await users.find({ role: { $in: ['admin', 'moderator'] } })
await users.find({ status: { $nin: ['banned', 'deleted'] } })
```

## String Operators

```typescript
await users.find({ name: { $startsWith: 'A' } })
await users.find({ email: { $endsWith: '@example.com' } })
await users.find({ name: { $like: 'J%n' } })      // John, Jan, Jason
await users.find({ bio: { $like: '%engineer%' } })  // contains

// Case-insensitive LIKE (v0.3.0+)
await users.find({ name: { $ilike: 'john' } })    // John, JOHN, john

// Contains substring (v0.3.0+)
await users.find({ bio: { $contains: 'engineer' } })  // simpler than $like
```

The `$like` operator is case-sensitive and uses SQL pattern syntax: `%` matches any sequence, `_` matches one character, and backslash escapes a pattern character. Literal Unix glob characters (`*`, `?`, `[` and `]`) retain their literal meaning.

The `$ilike` operator uses the same pattern syntax and folds ASCII case. Non-ASCII characters retain their case, following [SQLite's default case-folding behavior](https://www.sqlite.org/lang_expr.html#like).

`$contains`, `$startsWith` and `$endsWith` match literal text with exact case. `%`, `_` and backslash are ordinary characters in these operators. Empty text matches any present, non-null value. Use `$ilike` patterns for ASCII-insensitive matching.

Search text is also literal. Default search folds ASCII case; `caseSensitive: true` uses exact case. Search text containing `%`, `_` or backslash never becomes a pattern wildcard.

## Array Operators

For querying array fields:

```typescript
type User = Document<{
  tags: string[]
  scores: number[]
}>

// Contains all specified values
await users.find({ tags: { $all: ['typescript', 'react'] } })

// Exact array length
await users.find({ tags: { $size: 3 } })

// Element at index matches value
await users.find({ scores: { $index: 0 } })  // first element

// At least one element matches filter
await users.find({
  scores: { $elemMatch: { $gte: 90 } }
})
```

Object arrays support field filters, dotted paths, logical filters, and nested
array conditions. Every condition must match the same element:

```typescript
await orders.find({
  items: { $elemMatch: { sku: 'X', qty: { $gte: 2 } } }
})
```

Object filters skip scalar/null array elements. Non-array fields do not match
`$elemMatch`. `$exists` inside an element distinguishes JSON null from missing
paths. Logical `$not` and `$nor` normalize unknown comparisons to false before
negating, just as at the document level; add an explicit `$exists: true` condition
if missing fields should be excluded.

## Logical Operators

```typescript
// Implicit AND (all conditions must match)
await users.find({ role: 'admin', status: 'active' })

// Explicit AND
await users.find({
  $and: [
    { age: { $gte: 18 } },
    { age: { $lt: 65 } }
  ]
})

// OR (at least one must match)
await users.find({
  $or: [
    { role: 'admin' },
    { role: 'moderator' }
  ]
})

// NOR (none must match)
await users.find({
  $nor: [
    { status: 'banned' },
    { status: 'deleted' }
  ]
})

// NOT (negate condition)
await users.find({
  $not: { status: 'inactive' }
})
```

## Existence Operator

```typescript
// Field exists (even if null)
await users.find({ deletedAt: { $exists: true } })

// Field does not exist
await users.find({ phone: { $exists: false } })

// Field is null
await users.find({ deletedAt: null })

// Field exists and is not null
await users.find({ email: { $exists: true, $ne: null } })
```

## Query Options

```typescript
await users.find(
  { status: 'active' },
  {
    sort: { createdAt: -1, name: 1 },  // -1 desc, 1 asc
    limit: 20,
    skip: 40  // for offset pagination
  }
)
```

## Cancellation and Retries (v0.4.0+)

All query operations support cancellation and automatic retries.

### Cancellation

Cancel long-running queries with AbortSignal:

```typescript
// Simple timeout
const results = await users.find(
  { status: 'active' },
  { signal: AbortSignal.timeout(5000) }
)

// With AbortController for manual control
const controller = new AbortController()
setTimeout(() => controller.abort('Query took too long'), 5000)

try {
  const results = await users.find({}, { signal: controller.signal })
} catch (error) {
  if (error instanceof AbortedError) {
    console.log('Query cancelled:', error.reason)
  }
}
```

### Retries

Configure automatic retries for transient failures:

```typescript
// Retry with custom configuration
const results = await users.find(
  { status: 'active' },
  {
    retry: {
      retries: 3,
      minTimeout: 100,
      onFailedAttempt: (ctx) => console.log(`Retry ${ctx.attemptNumber}...`)
    }
  }
)

// Disable retries for a specific query
const user = await users.findOne(
  { email: 'user@example.com' },
  { retry: false }
)
```

See [Retries & Cancellation](/guide/retries-and-cancellation) for complete documentation.

## Field Projection (v0.3.0+)

Control which fields are returned using `select` or `omit`:

```typescript
// Select only specific fields
const users = await collection.find(
  { status: 'active' },
  { select: ['name', 'email'] }
)
// Returns: [{ _id, name, email }, ...]

// Omit specific fields
const users = await collection.find(
  { status: 'active' },
  { omit: ['password', 'internalNotes'] }
)
// Returns all fields except password and internalNotes

// Traditional MongoDB-style projection also supported
const users = await collection.find(
  { status: 'active' },
  { projection: { name: 1, email: 1 } }  // include
)

const users = await collection.find(
  { status: 'active' },
  { projection: { password: 0, internalNotes: 0 } }  // exclude
)
```

::: tip
`select` and `omit` are cleaner alternatives to `projection`. Use whichever style you prefer.
:::

::: tip Type-Safe Projections (v0.3.2+)
The `select` and `omit` options are fully type-safe! TypeScript automatically narrows the return type based on your projection:

```typescript
// TypeScript knows this returns Pick<User, '_id' | 'name' | 'email'>[]
const users = await collection.find(
  { status: 'active' },
  { select: ['name', 'email'] as const }
)
users[0].name      // ✅ TypeScript knows this exists
users[0].password  // ❌ TypeScript error: Property 'password' does not exist

// With omit, TypeScript returns Omit<User, 'password' | 'ssn'>[]
const safeUsers = await collection.find(
  { status: 'active' },
  { omit: ['password', 'ssn'] as const }
)
safeUsers[0].name     // ✅ TypeScript knows this exists
safeUsers[0].password // ❌ TypeScript error: Property 'password' does not exist
```

Use `as const` with your field arrays for the best type inference.
:::

## Text Search (v0.3.0+)

Search across multiple fields with the dedicated `search()` method:

```typescript
// Simple search across title and content
const articles = await collection.search('typescript', ['title', 'content'])

// Search with filter
const results = await collection.search('react', ['title', 'content'], {
  filter: { category: 'programming' },
  sort: { createdAt: -1 },
  limit: 10
})

// Search with projection
const titles = await collection.search('javascript', ['title', 'content'], {
  select: ['title', 'author']
})
```

You can also use the `search` option with `find()` for more complex queries:

```typescript
// Search across title and content fields
const articles = await collection.find(
  {},
  {
    search: {
      text: 'typescript',
      fields: ['title', 'content']
    }
  }
)

// Combine with filters
const articles = await collection.find(
  { category: 'programming' },
  {
    search: {
      text: 'react hooks',
      fields: ['title', 'content', 'tags']
    }
  }
)

// Search nested fields
const articles = await collection.find(
  {},
  {
    search: {
      text: 'optimization',
      fields: ['title', 'metadata.keywords']
    }
  }
)

// Case-sensitive search (default is case-insensitive)
const articles = await collection.find(
  {},
  {
    search: {
      text: 'TypeScript',
      fields: ['title'],
      caseSensitive: true
    }
  }
)
```

Text search uses SQL `LIKE '%term%'` patterns internally and matches any field containing the search text.

## Cursor Pagination (v0.3.0+)

For efficient pagination through large datasets, use cursor-based pagination instead of `skip`:

```typescript
// First page
const page1 = await collection.find(
  { status: 'active' },
  { sort: { createdAt: -1 }, limit: 20 }
)

// Next page - use cursor with last item's ID
const lastItem = page1[page1.length - 1]
const page2 = await collection.find(
  { status: 'active' },
  {
    sort: { createdAt: -1 },
    limit: 20,
    cursor: { after: lastItem._id }
  }
)

// Previous page - use 'before' cursor
const firstItem = page2[0]
const backToPage1 = await collection.find(
  { status: 'active' },
  {
    sort: { createdAt: -1 },
    limit: 20,
    cursor: { before: firstItem._id }
  }
)
```

::: tip Why cursor pagination?
- **Consistent**: Skip-based pagination breaks when items are inserted/deleted
- **Performant**: Cursors use indexed lookups, skip scans through rows
- **Scalable**: Performance stays constant regardless of page number
:::

::: warning
Cursor pagination requires a `sort` option. If no sort is provided, the cursor is ignored.
:::

## Nested Fields

Query nested objects using dot notation:

```typescript
type User = Document<{
  profile: {
    bio: string
    settings: { theme: string }
  }
}>

await users.find({ 'profile.bio': { $like: '%developer%' } })
await users.find({ 'profile.settings.theme': 'dark' })
```

## Type Safety

Queries are fully typed. TypeScript catches invalid field names and type mismatches:

```typescript
// ✅ Valid
await users.find({ age: { $gte: 18 } })

// ❌ Compile error: 'agee' doesn't exist
await users.find({ agee: { $gte: 18 } })

// ❌ Compile error: $startsWith only works on strings
await users.find({ age: { $startsWith: '1' } })

// ❌ Compile error: $gt only works on numbers/dates
await users.find({ name: { $gt: 'A' } })
```

## Complex Example

```typescript
const results = await users.find(
  {
    $and: [
      { status: 'active' },
      { age: { $gte: 18 } },
      {
        $or: [
          { role: 'admin' },
          { permissions: { $like: '%manage_users%' } }
        ]
      }
    ]
  },
  {
    sort: { createdAt: -1 },
    limit: 50
  }
)
```
