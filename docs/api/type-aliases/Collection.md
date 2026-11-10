[stratadb](../index.md) / Collection

# Type Alias: Collection&lt;T&gt;

```ts
type Collection<T> = CollectionReadContract<T> & CollectionWriteContract<T> & CollectionBatchContract<T> & CollectionEventsContract<T> & CollectionAdminContract<T>;
```

Defined in: [src/collection-types.ts:189](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/collection-types.ts#L189)

MongoDB-like collection interface for type-safe document operations.

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

The document type, must extend Document

## Remarks

Collection provides a complete CRUD API with full type safety. It wraps a SQLite
table and provides MongoDB-like methods for querying and manipulating documents.

Method reference: [reads/search](CollectionReadContract.md),
[single writes](CollectionWriteContract.md),
[batch writes](CollectionBatchContract.md),
[event listeners](CollectionEventsContract.md), and
[validation/lifecycle](CollectionAdminContract.md).

**Key Features:**
- Type-safe query filters with auto-completion
- Generated columns for indexed fields (optimized queries)
- JSONB storage for flexible document structure
- Built-in validation using Standard Schema validators
- Batch operations for performance
- Transaction support through database instance

**Document Storage:**
- User data stored in a single `body` JSONB column
- Indexed fields have generated columns with underscore prefix (e.g., `_age`)
- Auto-generated `_id` and `createdAt` fields
- Optional `updatedAt` tracking

**Comparison to MongoDB:**
- Similar API surface for easy migration
- Uses SQLite instead of MongoDB protocol
- Type-safe at compile time (MongoDB client isn't)
- Generated columns optimize common queries
- Standard Schema validation (not MongoDB JSON Schema)

## Example

```typescript
import { StrataDB, createSchema, type Document } from 'stratadb';
import { z } from 'zod';

// Define document type
type User = Document<{
  name: string;
  email: string;
  age: number;
  role: 'admin' | 'user';
}>;

// Create schema with validation
const userSchema = createSchema<User>()
  .field('name', { type: 'TEXT', indexed: true })
  .field('email', { type: 'TEXT', indexed: true, unique: true })
  .field('age', { type: 'INTEGER', indexed: true })
  .field('role', { type: 'TEXT', indexed: false })
  .validator(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    age: z.number().int().min(0),
    role: z.enum(['admin', 'user'])
  }))
  .build();

// Open database and get collection
const db = new StrataDB('myapp.db');
const users = db.collection('users', userSchema);

// Insert documents
const result = await users.insertOne({
  name: 'Alice',
  email: 'alice@example.com',
  age: 30,
  role: 'admin'
});
console.log(result._id); // Auto-generated UUID

// Query documents
const admins = await users.find({ role: 'admin' });
const adults = await users.find({ age: { $gte: 18 } });
const alice = await users.findOne({ email: 'alice@example.com' });

// Update documents
await users.updateOne(
  { email: 'alice@example.com' },
  { $set: { role: 'user' } }
);

// Delete documents
await users.deleteMany({ age: { $lt: 18 } });
```
