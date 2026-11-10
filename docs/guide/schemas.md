# Schemas

Field names and compound-index fields are checked against the document type,
including optional dotted paths such as `profile.city`. Misspellings fail during
TypeScript compilation. For schemas assembled from runtime metadata, use the
explicit escapes on either `createSchema<T>()` or `db.collection<T>(name)`:

```typescript
const dynamicName: string = 'extra'
const schema = createSchema<User>()
  .fieldUnchecked(dynamicName, { type: 'TEXT', indexed: true })
  .compoundIndexUnchecked('dynamic-index', [dynamicName])
  .build()
```

Unchecked names still require safe identifier segments at runtime; the escape
only bypasses document-name type checking.

## Adding indexed fields to an existing collection

Close and reopen the database with the updated schema. StrataDB adds missing
virtual generated columns and their indexes in one transaction, including
dotted fields, so existing documents are immediately queryable. An index failure
(for example duplicate values under a new unique index) rolls the DDL back.

Removed or type-changed stored generated columns are retained. By default,
StrataDB logs a warning; configure `onSchemaDrift: change => report(change)` on
the database to handle it, or `onSchemaDrift: "error"` to reject opening the
collection. Drift reports identify the collection, stored column, kind, stored
SQL type, and expected type when changed. BOOLEAN and INTEGER share SQLite's
INTEGER representation. Unindexed document properties have no stored column
declaration to compare. Renames, removals and type conversions require an
explicit application migration; StrataDB does not rewrite stored data.

Schemas define which fields get **generated columns** for fast querying. Fields not in the schema are still stored - they just live in the JSONB blob.

## How Storage Works

Every document is stored as JSONB. When you define a field in your schema, StrataDB creates a **generated column** that extracts that value for efficient querying:

```typescript
type User = Document<{
  email: string      // Will have generated column (defined in schema)
  password: string   // Stored in JSONB only (not in schema)
  profile: {         // Stored in JSONB only
    bio: string
    avatar: string
  }
}>

const schema = createSchema<User>()
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .build()
```

In this example:
- `email` → Generated column + index (fast lookups, unique constraint)
- `password`, `profile` → Stored in JSONB blob (no generated column)

You can still store and retrieve `password` and `profile` - they're part of your document. You just can't efficiently query them with operators like `$eq` or `$gt`.

## Generated Columns vs Indexes

These are **separate concepts**:

| Option | What it does | Use case |
|--------|--------------|----------|
| `.field('x', { type: 'TEXT' })` | Creates generated column only | Extracting for unique constraints, sorting |
| `.field('x', { type: 'TEXT', indexed: true })` | Generated column + B-tree index | Fast queries on this field |
| `.field('x', { type: 'TEXT', unique: true })` | Generated column + unique constraint | Enforce uniqueness (no index) |
| `.field('x', { type: 'TEXT', indexed: true, unique: true })` | All three | Fast unique lookups |

::: tip Why not auto-index every field?
Indexes have costs: write overhead and storage. You might define a field just for unique constraints or computed sorting without needing query performance. StrataDB keeps these concerns separate so you choose explicitly.
:::

## Creating a Schema

Use `createSchema<T>()` for a fluent builder API:

```typescript
import { createSchema, type Document } from 'stratadb'

type User = Document<{
  name: string
  email: string
  age: number
}>

const userSchema = createSchema<User>()
  .field('name', { type: 'TEXT', indexed: true })
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .field('age', { type: 'INTEGER', indexed: true })
  .build()
```

## Field Options

```typescript
.field('fieldName', {
  type: 'TEXT',        // SQLite type (required)
  indexed: true,       // Create index for fast queries
  unique: true,        // Enforce uniqueness
  nullable: false,     // Disallow null values
  default: 'value',    // Default value on insert
  path: '$.nested.field'  // JSON path for nested fields
})
```

### SQLite Types

| Type | TypeScript | Description |
|------|------------|-------------|
| `TEXT` | `string` | Text strings |
| `INTEGER` | `number` | Integers |
| `REAL` | `number` | Floating point |
| `BLOB` | `Uint8Array` | Binary data |
| `BOOLEAN` | `boolean` | Stored as INTEGER (0/1) |
| `NUMERIC` | `number` | Numeric affinity |

## Indexes

Indexed fields are extracted into **generated columns** for fast B-tree lookups:

```typescript
// Indexed field - uses generated column, O(log n) queries
.field('email', { type: 'TEXT', indexed: true })

// Non-indexed field - uses jsonb_extract, O(n) queries
.field('bio', { type: 'TEXT' })
```

### Compound Indexes

For queries on multiple fields:

```typescript
const schema = createSchema<User>()
  .field('age', { type: 'INTEGER', indexed: true })
  .field('status', { type: 'TEXT', indexed: true })
  .compoundIndex('age_status', ['age', 'status'])
  .build()

// This query uses the compound index efficiently:
await users.find({ age: { $gte: 18 }, status: 'active' })
```

### Unique Constraints

Compound declarations create real SQLite indexes. Opening an existing database with a unique declaration fails if duplicate tuples already exist. Fields explicitly marked indexed use generated columns; other compound fields use validated JSON expressions. SQLite permits multiple NULL tuples in unique indexes.

```typescript
// Single field unique
.field('email', { type: 'TEXT', indexed: true, unique: true })

// Compound unique (e.g., one email per tenant)
.compoundIndex('email_tenant', ['email', 'tenantId'], { unique: true })
```

## Timestamps

Timestamps are enabled by default. Disable their public fields with `.timestamps(false)`; every returned/event document then omits `createdAt` and `updatedAt`. Internal timestamp columns stay populated, and metadata is kept out of JSON bodies.

```typescript
const schema = createSchema<User>()
  .field('name', { type: 'TEXT' })
  .timestamps(true)  // Enable createdAt/updatedAt
  .build()
```

## Validation

Add runtime validation using Zod, ArkType, or custom functions:

```typescript
import { z } from 'zod'

const UserValidator = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().min(0),
})

const schema = createSchema<User>()
  .field('name', { type: 'TEXT' })
  .field('email', { type: 'TEXT', unique: true })
  .field('age', { type: 'INTEGER' })
  .validate((doc): doc is User => UserValidator.safeParse(doc).success)
  .build()
```

See [Validation](/guide/validation) for more examples.

## Inline Schema Definition

You can also define schemas inline when creating collections:

```typescript
const users = db.collection<User>('users')
  .field('name', { type: 'TEXT', indexed: true })
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .build()
```
