# Documents

Documents are the core data structure in StrataDB. Every document has a unique ID and optional timestamps.

## The Document Type

```typescript
import type { Document } from 'stratadb'

// Your data fields
type UserData = {
  name: string
  email: string
  age: number
}

// Document adds readonly _id
type User = Document<UserData>

// Equivalent to:
type User = {
  readonly _id: string
  readonly name: string
  readonly email: string
  readonly age: number
}
// Note: createdAt/updatedAt are added when you enable timestamps in the schema
```

## Auto-Generated Fields

When you insert a document, StrataDB automatically generates:

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `string` | UUID v4 (or custom if provided) |
| `createdAt` | `number` | Unix timestamp at insertion (if timestamps enabled) |
| `updatedAt` | `number` | Unix timestamp, updated on modifications (if timestamps enabled) |

```typescript
const user = await users.insertOne({
  name: 'Alice',
  email: 'alice@example.com',
  age: 30
})

console.log(user)
// {
//   _id: '550e8400-e29b-41d4-a716-446655440000',
//   name: 'Alice',
//   email: 'alice@example.com',
//   age: 30,
//   createdAt: 1703001234567,  // if timestamps enabled
//   updatedAt: 1703001234567   // if timestamps enabled
// }
```

## Custom IDs

You can provide your own ID:

```typescript
await users.insertOne({
  _id: 'custom-id-123',
  name: 'Bob',
  email: 'bob@example.com',
  age: 25
})
```

Or configure a custom ID generator for the entire database:

```typescript
const db = new Strata({
  database: 'app.db',
  idGenerator: () => `user_${Date.now()}_${Math.random().toString(36).slice(2)}`
})
```

### Using nanoid

[nanoid](https://github.com/ai/nanoid) is a popular choice for compact, URL-safe IDs:

```bash
bun add nanoid
```

```typescript
import { nanoid } from 'nanoid'
import { Strata } from 'stratadb'

const db = new Strata({
  database: 'app.db',
  idGenerator: () => nanoid()  // e.g., "V1StGXR8_Z5jdHi6B-myT"
})

// Or with custom length
const db = new Strata({
  database: 'app.db',
  idGenerator: () => nanoid(10)  // e.g., "IRFa-VaY2b"
})
```

### Using ULID

[ULID](https://github.com/ulid/spec) provides sortable, unique IDs:

```bash
bun add ulid
```

```typescript
import { ulid } from 'ulid'
import { Strata } from 'stratadb'

const db = new Strata({
  database: 'app.db',
  idGenerator: () => ulid()  // e.g., "01ARZ3NDEKTSV4RRFFQ69G5FAV"
})
```

## Nested Objects

Documents can contain nested objects and arrays:

```typescript
type Post = Document<{
  title: string
  content: string
  author: {
    name: string
    avatar: string
  }
  tags: string[]
  metadata: {
    views: number
    likes: number
  }
}>
```

::: tip Indexing Nested Fields
To index nested fields, use JSON path syntax in your schema:

```typescript
.field('authorName', {
  path: '$.author.name',
  type: 'TEXT',
  indexed: true
})
```
:::

## Atomic updates

`updateOne`, `findOneAndUpdate`, and `updateMany` accept either a plain deep merge
or an operator update. Choose one form per call:

```typescript
await users.updateOne(id, {
  $set: { 'profile.city': 'Oslo' },
  $inc: { visits: 1 },
  $push: { tags: 'returning' }
})
await users.updateMany({}, { $pull: { tags: 'obsolete' } })
await users.updateOne(id, { $unset: { 'profile.nickname': true } })
```

Operator paths are type checked and validated by the FieldResolver. IDs and
timestamps cannot be targeted. Rejecting mixed forms or overlapping paths avoids
ordering ambiguity. `$set` replaces the selected value; `$unset` removes it (use
`true`, `1`, or `''` as its operand). `$inc` requires finite numbers and starts a
missing field at zero. `$push` appends one JSON value and creates a missing array.
`$pull` removes all structurally equal JSON values, ignoring object key order
while preserving array order and distinguishing strings, numbers, booleans and
null. Pulling a missing field does nothing. Null/nonmatching target types reject;
updates cannot traverse a non-object parent.

Each operator operation executes one SQL UPDATE after preparing and validating
candidate documents inside the existing transaction boundary. Batch validation
failure leaves every row unchanged. Plain merges retain their prior deep-merge
behavior. Upserts seed plain scalar equality fields, including dotted paths,
before applying operators. Events carry the original `DocumentUpdate<T>` and
retain commit buffering. Narrow operator forms before reading plain event fields.

The JSONB functions are documented in the
[SQLite JSON reference](https://www.sqlite.org/json1.html).

## Storage Format

Internally, documents are stored as JSONB in SQLite:

- `_id` column: TEXT PRIMARY KEY
- `body` column: BLOB (JSONB containing document fields excluding metadata)
- `createdAt` and `updatedAt` columns: INTEGER (retained internally even when visible timestamps are disabled)
- Generated columns for indexed fields (e.g., `_name`, `_email`)

This gives you the flexibility of document storage with the query performance of relational indexes.
