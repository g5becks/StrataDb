[stratadb](../index.md) / Collection

# Type Alias: Collection&lt;T&gt;

```ts
type Collection<T> = object;
```

Defined in: [src/collection-types.ts:191](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L191)

MongoDB-like collection interface for type-safe document operations.

## Remarks

Collection provides a complete CRUD API with full type safety. It wraps a SQLite
table and provides MongoDB-like methods for querying and manipulating documents.

**Key Features:**
- Type-safe query filters with auto-completion
- Generated columns for indexed fields (optimized queries)
- JSONB storage for flexible document structure
- Built-in validation using Standard Schema validators
- Batch operations for performance
- Transaction support through database instance

**Document Storage:**
- All documents stored in a single `data` JSONB column
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

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

The document type, must extend Document

## Properties

### name

```ts
readonly name: string;
```

Defined in: [src/collection-types.ts:195](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L195)

Collection name (table name in SQLite).

***

### schema

```ts
readonly schema: SchemaDefinition<T>;
```

Defined in: [src/collection-types.ts:200](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L200)

Schema definition for this collection.

## Methods

### count()

```ts
count(filter, options?): Promise<number>;
```

Defined in: [src/collection-types.ts:378](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L378)

Count documents matching the query filter.

#### Parameters

##### filter

[`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Query filter to match documents

##### options?

Optional options including signal for cancellation

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;`number`&gt;

Promise resolving to the count of matching documents

#### Remarks

More efficient than `find(filter).length` since it only counts without
retrieving document data.

#### Example

```typescript
// Count all users
const total = await users.count({});

// Count active admins
const adminCount = await users.count({
  role: 'admin',
  status: 'active'
});

// Count adults
const adultCount = await users.count({ age: { $gte: 18 } });

// With abort signal
const controller = new AbortController();
const count = await users.count({}, { signal: controller.signal });
```

***

### deleteMany()

```ts
deleteMany(filter, options?): Promise<DeleteResult>;
```

Defined in: [src/collection-types.ts:968](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L968)

Delete multiple documents matching the query filter.

#### Parameters

##### filter

[`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Query filter to find documents to delete

##### options?

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;[`DeleteResult`](DeleteResult.md)&gt;

Promise resolving to delete result with statistics

#### Remarks

Deletes all documents that match the filter.
Use an empty filter `{}` to delete all documents in the collection.

**Warning:**
This operation cannot be undone. Consider backing up data before
bulk delete operations.

#### Example

```typescript
// Delete all inactive users
const result = await users.deleteMany({ status: 'inactive' });
console.log(`Deleted ${result.deletedCount} users`);

// Delete all documents (use with caution!)
await users.deleteMany({});

// With abort signal
const controller = new AbortController();
const result = await users.deleteMany(filter, { signal: controller.signal });
```

***

### deleteOne()

```ts
deleteOne(filter, options?): Promise<boolean>;
```

Defined in: [src/collection-types.ts:676](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L676)

Delete a single document by ID or filter.

#### Parameters

##### filter

`string` \| [`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Document ID (string) or query filter

##### options?

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;`boolean`&gt;

Promise resolving to `true` if document was deleted, `false` if not found

#### Remarks

This method accepts either a string ID or a query filter for maximum flexibility.
When you have the document ID, pass it directly as a string for convenience.
When you need to delete by other fields, pass a filter object.

Deletes the first document that matches the filter.
If no document matches, returns `false`.

#### Example

```typescript
// Delete by ID (string)
const deleted = await users.deleteOne('user-123')
if (deleted) {
  console.log('User deleted successfully')
}

// Delete by filter
const deleted = await users.deleteOne({ email: 'inactive@example.com' })

// Delete with complex filter
const deleted = await users.deleteOne({
  status: 'inactive',
  lastLogin: { $lt: Date.now() - 90 * 24 * 60 * 60 * 1000 } // 90 days
})

// With abort signal
const controller = new AbortController();
const deleted = await users.deleteOne(filter, { signal: controller.signal });
```

***

### distinct()

```ts
distinct<K>(
   field, 
   filter?, 
   options?
): Promise<T[K][]>;
```

Defined in: [src/collection-types.ts:1007](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L1007)

Find distinct values for a specified field across the collection.

#### Type Parameters

##### K

`K` *extends* `string` \| `number` \| `symbol`

#### Parameters

##### field

`K`

The field name to get distinct values for

##### filter?

[`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Optional query filter to narrow results

##### options?

Optional options including signal for cancellation

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;`T`\[`K`\][]&gt;

Promise resolving to array of unique values for the field

#### Remarks

Returns an array of unique values for the specified field.
If a filter is provided, only documents matching the filter are considered.

The method uses SQLite's DISTINCT clause for efficient querying.
For indexed fields, uses the generated column; for non-indexed fields, uses JSON extraction.

#### Example

```typescript
// Get all unique ages
const ages = await users.distinct('age');
console.log(ages); // [25, 30, 35, 40]

// Get unique roles for active users
const activeRoles = await users.distinct('role', { active: true });

// Get unique tags (array field)
const tags = await users.distinct('tags');

// With abort signal
const controller = new AbortController();
const ages = await users.distinct('age', {}, { signal: controller.signal });
```

***

### drop()

```ts
drop(options?): Promise<void>;
```

Defined in: [src/collection-types.ts:1072](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L1072)

Drop the collection (delete the table).

#### Parameters

##### options?

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;`void`&gt;

Promise resolving when the collection is dropped

#### Remarks

Permanently deletes the collection and all its documents.
This operation cannot be undone.

The table and all associated indexes are removed from the database.
Use with caution in production environments.

#### Example

```typescript
// Drop a temporary collection
await tempCollection.drop();

// Drop with confirmation
if (confirm('Really delete all users?')) {
  await users.drop();
}

// With abort signal
const controller = new AbortController();
await collection.drop({ signal: controller.signal });
```

***

### estimatedDocumentCount()

```ts
estimatedDocumentCount(options?): Promise<number>;
```

Defined in: [src/collection-types.ts:1040](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L1040)

Get an estimated count of documents in the collection.

#### Parameters

##### options?

Optional options including signal for cancellation

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;`number`&gt;

Promise resolving to the estimated document count

#### Remarks

Returns a fast estimate of the document count using SQLite table statistics.
This is much faster than count() for large collections but may not be exact.

Uses SQLite's internal statistics which are updated periodically.
For exact counts, use the count() method instead.

#### Example

```typescript
const estimate = await users.estimatedDocumentCount();
console.log(`Approximately ${estimate} users`);

// Compare with exact count
const exact = await users.count({});
console.log(`Exact: ${exact}, Estimated: ${estimate}`);

// With abort signal
const controller = new AbortController();
const estimate = await users.estimatedDocumentCount({ signal: controller.signal });
```

***

### find()

#### Call Signature

```ts
find<K>(filter, options): Promise<readonly Pick<T, K | keyof T & "_id">[]>;
```

Defined in: [src/collection-types.ts:277](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L277)

Find all documents matching the query filter.

##### Type Parameters

###### K

`K` *extends* `string` \| `number` \| `symbol`

##### Parameters

###### filter

[`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Query filter to match documents

###### options

[`QueryOptionsWithSelect`](QueryOptionsWithSelect.md)&lt;`T`, `K`&gt;

Query options for sorting, pagination, and projection

##### Returns

`Promise`&lt;readonly `Pick`&lt;`T`, `K` \| keyof `T` & `"_id"`&gt;[]&gt;

Promise resolving to array of matching documents

##### Remarks

Returns all documents that match the filter. For large result sets,
use `limit` and `skip` options for pagination.

**Performance:**
- Indexed fields use generated columns (fast)
- Non-indexed fields use jsonb_extract (slower)
- Consider adding indexes for frequently queried fields

##### Example

```typescript
// Find all active admins
const admins = await users.find({
  role: 'admin',
  status: 'active'
});

// Find with sorting and pagination
const page = await users.find(
  { age: { $gte: 18 } },
  { sort: { createdAt: -1 }, limit: 20, skip: 40 }
);

// Find with complex query
const results = await users.find({
  $and: [
    { age: { $gte: 18, $lt: 65 } },
    {
      $or: [
        { role: 'admin' },
        { verified: true }
      ]
    }
  ]
});
```

#### Call Signature

```ts
find<K>(filter, options): Promise<readonly Omit<T, K>[]>;
```

Defined in: [src/collection-types.ts:283](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L283)

##### Type Parameters

###### K

`K` *extends* `string` \| `number` \| `symbol`

##### Parameters

###### filter

[`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

###### options

[`QueryOptionsWithOmit`](QueryOptionsWithOmit.md)&lt;`T`, `K`&gt;

##### Returns

`Promise`&lt;readonly `Omit`&lt;`T`, `K`&gt;[]&gt;

#### Call Signature

```ts
find(filter, options?): Promise<readonly T[]>;
```

Defined in: [src/collection-types.ts:289](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L289)

##### Parameters

###### filter

[`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

###### options?

[`QueryOptions`](QueryOptions.md)&lt;`T`&gt;

##### Returns

`Promise`&lt;readonly `T`[]&gt;

***

### findById()

```ts
findById(id, options?): Promise<T | null>;
```

Defined in: [src/collection-types.ts:227](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L227)

Find a single document by its ID.

#### Parameters

##### id

`string`

The document ID to search for

##### options?

Optional options including signal for cancellation

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;`T` \| `null`&gt;

Promise resolving to the document, or null if not found

#### Remarks

This is the fastest way to retrieve a specific document since it uses
the primary key index.

#### Example

```typescript
const user = await users.findById('123e4567-e89b-12d3-a456-426614174000');
if (user) {
  console.log(user.name);
}

// With abort signal
const controller = new AbortController();
const user = await users.findById(id, { signal: controller.signal });
```

***

### findOne()

#### Call Signature

```ts
findOne<K>(filter, options): Promise<Pick<T, keyof T & "_id" | K> | null>;
```

Defined in: [src/collection-types.ts:331](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L331)

Find the first document matching the query filter or ID.

##### Type Parameters

###### K

`K` *extends* `string` \| `number` \| `symbol`

##### Parameters

###### filter

`string` \| [`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Document ID or query filter to match documents

###### options

`Omit`&lt;[`QueryOptionsWithSelect`](QueryOptionsWithSelect.md)&lt;`T`, `K`&gt;, `"limit"` \| `"skip"`&gt;

Query options for sorting and projection

##### Returns

`Promise`&lt;`Pick`&lt;`T`, keyof `T` & `"_id"` \| `K`&gt; \| `null`&gt;

Promise resolving to the first matching document, or null if none found

##### Remarks

Equivalent to `find(filter, { ...options, limit: 1 })[0]` but more efficient
since it stops after finding the first match.

Accepts either a string ID or a full QueryFilter object for flexible querying:
- String ID: `{ _id: string }` filter is applied automatically
- QueryFilter: Full MongoDB-style query filtering

##### Example

```typescript
// Find by document ID
const user = await users.findOne('123e4567-e89b-12d3-a456-426614174000');
if (user) {
  console.log(user.name);
}

// Find by query filter
const admin = await users.findOne({ role: 'admin' });

// Find with options
const latest = await users.findOne(
  {},
  { sort: { createdAt: -1 } }
);

// Check if email exists
const exists = await users.findOne({ email: 'alice@example.com' });
if (exists) {
  console.log('Email already registered');
}
```

#### Call Signature

```ts
findOne<K>(filter, options): Promise<Omit<T, K> | null>;
```

Defined in: [src/collection-types.ts:337](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L337)

##### Type Parameters

###### K

`K` *extends* `string` \| `number` \| `symbol`

##### Parameters

###### filter

`string` \| [`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

###### options

`Omit`&lt;[`QueryOptionsWithOmit`](QueryOptionsWithOmit.md)&lt;`T`, `K`&gt;, `"limit"` \| `"skip"`&gt;

##### Returns

`Promise`&lt;`Omit`&lt;`T`, `K`&gt; \| `null`&gt;

#### Call Signature

```ts
findOne(filter, options?): Promise<T | null>;
```

Defined in: [src/collection-types.ts:343](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L343)

##### Parameters

###### filter

`string` \| [`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

###### options?

`Omit`&lt;[`QueryOptions`](QueryOptions.md)&lt;`T`&gt;, `"limit"` \| `"skip"`&gt;

##### Returns

`Promise`&lt;`T` \| `null`&gt;

***

### findOneAndDelete()

```ts
findOneAndDelete(filter, options?): Promise<T | null>;
```

Defined in: [src/collection-types.ts:723](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L723)

Find and delete a single document atomically.

#### Parameters

##### filter

`string` \| [`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Document ID (string) or query filter

##### options?

Query options (sort)

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

###### sort?

[`SortSpec`](SortSpec.md)&lt;`T`&gt;

#### Returns

`Promise`&lt;`T` \| `null`&gt;

Promise resolving to the deleted document, or null if not found

#### Remarks

This method accepts either a string ID or a query filter for maximum flexibility.
When you have the document ID, pass it directly as a string for convenience.
When you need to delete by other fields, pass a filter object.

This operation is atomic - it finds and deletes in a single operation.
Useful when you need the deleted document's data (e.g., for logging, undo operations).

When multiple documents match the filter, the sort option determines which one is deleted.

#### Example

```typescript
// Delete by ID
const deleted = await users.findOneAndDelete('user-123');
if (deleted) {
  console.log(`Deleted user: ${deleted.name}`);
  await logDeletion(deleted);
}

// Delete by filter
const deleted = await users.findOneAndDelete({ email: 'old@example.com' });

// Delete with sort (delete oldest inactive user)
const deleted = await users.findOneAndDelete(
  { status: 'inactive' },
  { sort: { createdAt: 1 } }
);

// With abort signal
const controller = new AbortController();
const deleted = await users.findOneAndDelete(filter, { signal: controller.signal });
```

***

### findOneAndReplace()

```ts
findOneAndReplace(
   filter, 
   replacement, 
   options?
): Promise<T | null>;
```

Defined in: [src/collection-types.ts:848](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L848)

Find and replace a single document atomically.

#### Parameters

##### filter

`string` \| [`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Document ID (string) or query filter

##### replacement

`Omit`&lt;`T`, `"_id"` \| `"createdAt"` \| `"updatedAt"`&gt;

Complete replacement document (without _id, createdAt, updatedAt)

##### options?

Replace options (sort, returnDocument, upsert)

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### returnDocument?

`"before"` \| `"after"`

###### signal?

`AbortSignal`

###### sort?

[`SortSpec`](SortSpec.md)&lt;`T`&gt;

###### upsert?

`boolean`

#### Returns

`Promise`&lt;`T` \| `null`&gt;

Promise resolving to the document before or after replacement, or null if not found

#### Remarks

This method accepts either a string ID or a query filter for maximum flexibility.
When you have the document ID, pass it directly as a string for convenience.
When you need to replace by other fields, pass a filter object.

This operation replaces the ENTIRE document (except _id, createdAt).
Unlike `findOneAndUpdate` which merges fields, this replaces everything.
The replacement document is validated against the schema.
Default returnDocument is 'after'.

#### Example

```typescript
// Replace by ID
const replaced = await users.findOneAndReplace(
  'user-123',
  {
    name: 'New Name',
    email: 'new@example.com',
    age: 30,
    active: true,
    tags: []
  },
  { returnDocument: 'after' }
);

// Replace by filter
const replaced = await users.findOneAndReplace(
  { email: 'old@example.com' },
  {
    name: 'New Name',
    email: 'new@example.com',
    age: 30,
    active: true,
    tags: []
  }
);

// With abort signal
const controller = new AbortController();
const replaced = await users.findOneAndReplace(filter, replacement, { signal: controller.signal });
```

***

### findOneAndUpdate()

```ts
findOneAndUpdate(
   filter, 
   update, 
   options?
): Promise<T | null>;
```

Defined in: [src/collection-types.ts:786](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L786)

Find and update a single document atomically.

#### Parameters

##### filter

`string` \| [`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Document ID (string) or query filter

##### update

`Omit`&lt;`Partial`&lt;`T`&gt;, `"_id"` \| `"createdAt"` \| `"updatedAt"`&gt;

Partial document with fields to update

##### options?

Update options (sort, returnDocument, upsert)

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### returnDocument?

`"before"` \| `"after"`

###### signal?

`AbortSignal`

###### sort?

[`SortSpec`](SortSpec.md)&lt;`T`&gt;

###### upsert?

`boolean`

#### Returns

`Promise`&lt;`T` \| `null`&gt;

Promise resolving to the document before or after update, or null if not found

#### Remarks

This method accepts either a string ID or a query filter for maximum flexibility.
When you have the document ID, pass it directly as a string for convenience.
When you need to update by other fields, pass a filter object.

This operation is atomic - it finds and updates in a single logical operation.
Use `returnDocument` to control whether you get the document state before or after the update.
Default is 'after'.

#### Example

```typescript
// Update by ID
const updated = await users.findOneAndUpdate(
  'user-123',
  { loginCount: 5 },
  { returnDocument: 'after' }
);

// Update by filter
const updated = await users.findOneAndUpdate(
  { email: 'alice@example.com' },
  { loginCount: 5 },
  { returnDocument: 'after' }
);
console.log(`New login count: ${updated?.loginCount}`);

// Get previous state before update
const before = await users.findOneAndUpdate(
  { _id: userId },
  { status: 'archived' },
  { returnDocument: 'before' }
);
await logStatusChange(before, 'archived');

// Upsert with returnDocument
const result = await users.findOneAndUpdate(
  { email: 'new@example.com' },
  { name: 'New User', age: 25 },
  { upsert: true, returnDocument: 'after' }
);

// With abort signal
const controller = new AbortController();
const updated = await users.findOneAndUpdate(filter, update, { signal: controller.signal });
```

***

### insertMany()

```ts
insertMany(docs, options?): Promise<InsertManyResult<T>>;
```

Defined in: [src/collection-types.ts:893](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L893)

Insert multiple documents into the collection.

#### Parameters

##### docs

readonly `Omit`&lt;`T`, `"_id"` \| `"createdAt"` \| `"updatedAt"`&gt;[]

Array of documents to insert

##### options?

###### ordered?

`boolean`

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;[`InsertManyResult`](InsertManyResult.md)&lt;`T`&gt;&gt;

Promise resolving to insert result with all new documents

#### Remarks

Inserts all documents in a single transaction for performance.
If any document fails validation, the entire operation rolls back.
Automatically generates `id`, `createdAt`, and `updatedAt` for each document.

**Performance:**
Much faster than multiple `insertOne` calls since it uses a single transaction.

#### Throws

If any document fails schema validation

#### Throws

If any unique constraint is violated

#### Example

```typescript
const result = await users.insertMany([
  { name: 'Alice', email: 'alice@example.com', age: 30, role: 'admin' },
  { name: 'Bob', email: 'bob@example.com', age: 25, role: 'user' },
  { name: 'Charlie', email: 'charlie@example.com', age: 35, role: 'user' }
]);
console.log(`Inserted ${result.insertedCount} users`);

// With abort signal
const controller = new AbortController();
const result = await users.insertMany(docs, { signal: controller.signal });
```

***

### insertOne()

```ts
insertOne(doc, options?): Promise<T>;
```

Defined in: [src/collection-types.ts:525](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L525)

Insert a single document into the collection.

#### Parameters

##### doc

`Omit`&lt;`T`, `"_id"` \| `"createdAt"` \| `"updatedAt"`&gt;

Document to insert (without _id, createdAt, updatedAt)

##### options?

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;`T`&gt;

Promise resolving to the inserted document with generated _id

#### Remarks

Validates the document against the schema before inserting.
Automatically generates:
- `_id`: UUID v4
- `createdAt`: Current timestamp
- `updatedAt`: Current timestamp (if schema has this field)

**Validation:**
If validation fails, throws `ValidationError` with details.

/**
Insert a single document into the collection.

#### Throws

If document fails schema validation

#### Throws

If unique constraint is violated

#### Example

```typescript
try {
  const user = await users.insertOne({
    name: 'Bob',
    email: 'bob@example.com',
    age: 25,
    role: 'user'
  });
  console.log(`Inserted user with ID: ${user._id}`);
  console.log(`User name: ${user.name}`);
} catch (err) {
  if (err instanceof ValidationError) {
    console.error('Invalid user:', err.message);
  }
}

// With abort signal
const controller = new AbortController();
const user = await users.insertOne(doc, { signal: controller.signal });
```

***

### listenerCount()

```ts
listenerCount(event): number;
```

Defined in: [src/collection-types.ts:1329](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L1329)

Get the number of listeners for an event.

#### Parameters

##### event

keyof [`CollectionEventMap`](CollectionEventMap.md)&lt;[`Document`](Document.md)&gt;

The event name

#### Returns

`number`

Number of registered listeners for the event

#### Remarks

Returns the count of listeners currently registered for the specified event.
Useful for debugging or monitoring event listener usage.

Returns 0 if no listeners are registered or if the event emitter
has not been initialized yet.

#### Example

```typescript
// Check if anyone is listening
if (users.listenerCount('insert') === 0) {
  console.log('No insert listeners registered')
}

// Monitor listener count
users.on('insert', listener1)
users.on('insert', listener2)
console.log(users.listenerCount('insert')) // 2

users.off('insert', listener1)
console.log(users.listenerCount('insert')) // 1
```

***

### listeners()

```ts
listeners<E>(event): ((...args) => void)[];
```

Defined in: [src/collection-types.ts:1361](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L1361)

Get all listeners for an event.

#### Type Parameters

##### E

`E` *extends* keyof [`CollectionEventMap`](CollectionEventMap.md)&lt;[`Document`](Document.md)&gt;

The event name type

#### Parameters

##### event

`E`

The event name

#### Returns

((...`args`) => `void`)[]

Array of listener functions registered for the event

#### Remarks

Returns an array of all listener functions currently registered for
the specified event. The array is a copy, so modifying it won't affect
the actual listeners.

Returns an empty array if no listeners are registered or if the event
emitter has not been initialized yet.

#### Example

```typescript
// Get all insert listeners
const insertListeners = users.listeners('insert')
console.log(`${insertListeners.length} listeners registered`)

// Iterate over listeners
for (const listener of users.listeners('update')) {
  console.log('Listener:', listener.name)
}

// Check if specific listener is registered
const hasListener = users.listeners('delete').includes(myListener)
```

***

### off()

```ts
off<E>(event, listener): Collection<T>;
```

Defined in: [src/collection-types.ts:1265](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L1265)

Remove an event listener.

#### Type Parameters

##### E

`E` *extends* keyof [`CollectionEventMap`](CollectionEventMap.md)&lt;[`Document`](Document.md)&gt;

The event name type

#### Parameters

##### event

`E`

The event name

##### listener

(...`args`) => `void`

The callback function to remove

#### Returns

`Collection`&lt;`T`&gt;

The collection instance for method chaining

#### Remarks

Removes a previously registered listener. The listener reference must
be the same function reference that was passed to `on()` or `once()`.

If the listener was not registered, this method has no effect.

#### Example

```typescript
// Define listener function
const logInsert = (event: InsertEvent<User>) => {
  console.log('User inserted:', event.document._id)
}

// Register listener
users.on('insert', logInsert)

// Later, remove it
users.off('insert', logInsert)

// Note: Arrow functions must use the same reference
const listener = (event) => console.log(event)
users.on('insert', listener)
users.off('insert', listener) // Works

// This won't work (different function reference):
users.on('insert', (event) => console.log(event))
users.off('insert', (event) => console.log(event)) // Does nothing
```

***

### on()

```ts
on<E>(event, listener): Collection<T>;
```

Defined in: [src/collection-types.ts:1193](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L1193)

Register an event listener for collection events.

#### Type Parameters

##### E

`E` *extends* keyof [`CollectionEventMap`](CollectionEventMap.md)&lt;[`Document`](Document.md)&gt;

The event name type

#### Parameters

##### event

`E`

The event name to listen for

##### listener

(...`args`) => `void`

The callback function to invoke when the event is emitted

#### Returns

`Collection`&lt;`T`&gt;

The collection instance for method chaining

#### Remarks

Registers a listener function that will be called whenever the specified
event is emitted. The listener receives the event payload as its argument.

The event emitter is lazily initialized on the first call to `on()`,
ensuring zero overhead when events are not used.

All events are emitted **after** the operation completes successfully.
Events do not fire if the operation throws an error (except for 'error' events).

#### Example

```typescript
// Audit logging
users.on('insert', (event) => {
  console.log(`New user created: ${event.document._id}`)
  auditLog.record('user.created', event.document)
})

// Cache invalidation
users.on('update', (event) => {
  if (event.document) {
    cache.invalidate(`user:${event.document._id}`)
  }
})

// Error monitoring
users.on('error', (event) => {
  errorTracker.capture(event.error, {
    operation: event.operation,
    context: event.context
  })
})

// Method chaining
users
  .on('insert', logInsert)
  .on('update', logUpdate)
  .on('delete', logDelete)
```

***

### once()

```ts
once<E>(event, listener): Collection<T>;
```

Defined in: [src/collection-types.ts:1223](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L1223)

Register a one-time event listener.

#### Type Parameters

##### E

`E` *extends* keyof [`CollectionEventMap`](CollectionEventMap.md)&lt;[`Document`](Document.md)&gt;

The event name type

#### Parameters

##### event

`E`

The event name to listen for

##### listener

(...`args`) => `void`

The callback function to invoke once

#### Returns

`Collection`&lt;`T`&gt;

The collection instance for method chaining

#### Remarks

Registers a listener that will be automatically removed after it is
invoked once. Useful for setup tasks or one-time notifications.

#### Example

```typescript
// Log only the first user creation
users.once('insert', (event) => {
  console.log('First user created:', event.document._id)
})

// One-time initialization
users.once('insert', async (event) => {
  await initializeUserMetrics()
})
```

***

### removeAllListeners()

```ts
removeAllListeners(event?): Collection<T>;
```

Defined in: [src/collection-types.ts:1298](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L1298)

Remove all listeners for an event, or all events if no event specified.

#### Parameters

##### event?

keyof CollectionEventMap\<Document\>

Optional event name to clear listeners for

#### Returns

`Collection`&lt;`T`&gt;

The collection instance for method chaining

#### Remarks

If an event name is provided, removes all listeners for that event.
If no event name is provided, removes all listeners for all events.

Use with caution in shared codebases where multiple parts of the
application might be listening to the same events.

#### Example

```typescript
// Remove all 'insert' listeners
users.removeAllListeners('insert')

// Remove all listeners for all events
users.removeAllListeners()

// Cleanup before disposal
function cleanup() {
  users.removeAllListeners()
  db.close()
}
```

***

### replaceOne()

```ts
replaceOne(
   filter, 
   doc, 
   options?
): Promise<T | null>;
```

Defined in: [src/collection-types.ts:634](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L634)

Replace a single document by ID or filter.

#### Parameters

##### filter

`string` \| [`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Document ID (string) or query filter

##### doc

`Omit`&lt;`T`, `"_id"` \| `"createdAt"` \| `"updatedAt"`&gt;

New document to replace with (without _id, createdAt, updatedAt)

##### options?

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;`T` \| `null`&gt;

Promise resolving to the replaced document, or null if not found

#### Remarks

This method accepts either a string ID or a query filter for maximum flexibility.
When you have the document ID, pass it directly as a string for convenience.
When you need to replace by other fields, pass a filter object.

Completely replaces the matched document with the new document.
Preserves `_id` and `createdAt`, updates `updatedAt`.
Validates the new document against the schema.

**Difference from updateOne:**
- `updateOne`: Merges specific fields into existing document
- `replaceOne`: Replaces entire document (except _id, createdAt)

#### Throws

If new document fails schema validation

#### Example

```typescript
// Replace by ID (string)
const replaced = await users.replaceOne(
  'user-123',
  {
    name: 'Alice Smith',
    email: 'alice.smith@example.com',
    age: 31,
    role: 'admin'
  }
);

// Replace by filter
const replaced = await users.replaceOne(
  { email: 'old@example.com' },
  {
    name: 'Alice Smith',
    email: 'new@example.com',
    age: 31,
    role: 'admin'
  }
);

// With abort signal
const controller = new AbortController();
const replaced = await users.replaceOne(filter, doc, { signal: controller.signal });
```

***

### search()

#### Call Signature

```ts
search<K>(
   text, 
   fields, 
   options
): Promise<readonly Pick<T, keyof T & "_id" | K>[]>;
```

Defined in: [src/collection-types.ts:437](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L437)

Search for documents across multiple fields.

##### Type Parameters

###### K

`K` *extends* `string` \| `number` \| `symbol`

##### Parameters

###### text

`string`

The search text to find

###### fields

readonly (`string` \| keyof `T`)[]

Array of field names to search within

###### options

`Omit`&lt;[`QueryOptionsWithSelect`](QueryOptionsWithSelect.md)&lt;`T`, `K`&gt;, `"search"`&gt; & `object`

Optional query options (filter, sort, limit, projection, etc.)

##### Returns

`Promise`&lt;readonly `Pick`&lt;`T`, keyof `T` & `"_id"` \| `K`&gt;[]&gt;

Promise resolving to array of matching documents

##### Remarks

Performs case-insensitive text search across the specified fields using
SQL LIKE patterns. A document matches if the search text appears in ANY
of the specified fields.

**Search behavior:**
- Case-insensitive by default
- Matches partial strings (e.g., "script" matches "TypeScript")
- Uses OR logic across fields (match in any field returns the document)

**Performance:**
- Indexed fields use generated columns for faster matching
- Non-indexed fields use JSON extraction (slower for large datasets)
- Consider indexing frequently searched fields

**Comparison to find() with search option:**
- `search()` is cleaner when text search is the primary operation
- `find()` with `search` option is better when combining with complex filters

##### Example

```typescript
// Search for "typescript" in title and content
const articles = await posts.search('typescript', ['title', 'content']);

// Search with additional filtering
const results = await posts.search('react', ['title', 'content'], {
  filter: { category: 'programming' },
  sort: { createdAt: -1 },
  limit: 10
});

// Search in nested fields
const docs = await articles.search('hooks', ['title', 'metadata.keywords']);

// Search with projection
const titles = await posts.search('javascript', ['title', 'content'], {
  select: ['title', 'author']
});

// Case-sensitive search
const exact = await posts.search('TypeScript', ['title'], {
  caseSensitive: true
});
```

#### Call Signature

```ts
search<K>(
   text, 
   fields, 
   options
): Promise<readonly Omit<T, K>[]>;
```

Defined in: [src/collection-types.ts:447](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L447)

##### Type Parameters

###### K

`K` *extends* `string` \| `number` \| `symbol`

##### Parameters

###### text

`string`

###### fields

readonly (`string` \| keyof `T`)[]

###### options

`Omit`&lt;[`QueryOptionsWithOmit`](QueryOptionsWithOmit.md)&lt;`T`, `K`&gt;, `"search"`&gt; & `object`

##### Returns

`Promise`&lt;readonly `Omit`&lt;`T`, `K`&gt;[]&gt;

#### Call Signature

```ts
search(
   text, 
   fields, 
   options?
): Promise<readonly T[]>;
```

Defined in: [src/collection-types.ts:457](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L457)

##### Parameters

###### text

`string`

###### fields

readonly (`string` \| keyof `T`)[]

###### options?

`Omit`&lt;[`QueryOptions`](QueryOptions.md)&lt;`T`&gt;, `"search"`&gt; & `object`

##### Returns

`Promise`&lt;readonly `T`[]&gt;

***

### updateMany()

```ts
updateMany(
   filter, 
   update, 
   options?
): Promise<UpdateResult>;
```

Defined in: [src/collection-types.ts:934](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L934)

Update multiple documents matching the query filter.

#### Parameters

##### filter

[`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Query filter to find documents to update

##### update

`Omit`&lt;`Partial`&lt;`T`&gt;, `"_id"` \| `"createdAt"` \| `"updatedAt"`&gt;

Update operations to apply

##### options?

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;[`UpdateResult`](UpdateResult.md)&gt;

Promise resolving to update result with statistics

#### Remarks

Updates all documents that match the filter.
Uses MongoDB-style update operators.
Automatically updates `updatedAt` for each modified document.

#### Example

```typescript
// Set all inactive users to deleted status
const result = await users.updateMany(
  { status: 'inactive' },
  { $set: { status: 'deleted' } }
);
console.log(`Updated ${result.modifiedCount} users`);

// Give all admins a badge
await users.updateMany(
  { role: 'admin' },
  { $set: { badge: 'admin' } }
);

// With abort signal
const controller = new AbortController();
const result = await users.updateMany(filter, update, { signal: controller.signal });
```

***

### updateOne()

```ts
updateOne(
   filter, 
   update, 
   options?
): Promise<T | null>;
```

Defined in: [src/collection-types.ts:573](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L573)

Update a single document matching the query filter or ID.

#### Parameters

##### filter

`string` \| [`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Document ID or query filter to find the document to update

##### update

`Omit`&lt;`Partial`&lt;`T`&gt;, `"_id"` \| `"createdAt"` \| `"updatedAt"`&gt;

Partial document with fields to update

##### options?

Optional upsert configuration

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

###### upsert?

`boolean`

#### Returns

`Promise`&lt;`T` \| `null`&gt;

Promise resolving to the updated document, or null if not found

#### Remarks

Updates the first document that matches the filter.
Merges the provided partial document with the existing document.
Automatically updates `updatedAt` if present in schema.

Accepts either a string ID or a full QueryFilter object for flexible targeting:
- String ID: `{ _id: string }` filter is applied automatically
- QueryFilter: Full MongoDB-style query filtering

#### Example

```typescript
// Update by document ID
const updated = await users.updateOne(
  '123e4567-e89b-12d3-a456-426614174000',
  { role: 'admin', verified: true }
);

// Update by query filter
await users.updateOne(
  { email: 'alice@example.com' },
  { role: 'admin', verified: true }
);

// Update with upsert
await users.updateOne(
  { email: 'new@example.com' },
  { role: 'user' },
  { upsert: true }
);

// With abort signal
const controller = new AbortController();
await users.updateOne(filter, update, { signal: controller.signal });
```

***

### validate()

```ts
validate(doc, options?): Promise<T>;
```

Defined in: [src/collection-types.ts:1113](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L1113)

Validate a document against the schema (async).

#### Parameters

##### doc

`unknown`

Document to validate

##### options?

###### retry?

[`RetryOptions`](RetryOptions.md) \| `false`

###### signal?

`AbortSignal`

#### Returns

`Promise`&lt;`T`&gt;

Promise resolving to true if valid

#### Remarks

Validates the document against the schema validator.
Supports both synchronous and asynchronous validators.
Throws `ValidationError` if validation fails.

#### Throws

If document fails validation

#### Example

```typescript
try {
  await users.validate({
    name: 'Alice',
    email: 'invalid-email',
    age: -5,
    role: 'admin'
  });
} catch (err) {
  if (err instanceof ValidationError) {
    console.error(`Invalid field: ${err.field}`);
    console.error(`Error: ${err.message}`);
  }
}

// With abort signal
const controller = new AbortController();
await users.validate(doc, { signal: controller.signal });
```

***

### validateSync()

```ts
validateSync(doc): T;
```

Defined in: [src/collection-types.ts:1141](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-types.ts#L1141)

Validate a document against the schema (sync).

#### Parameters

##### doc

`unknown`

Document to validate

#### Returns

`T`

True if valid

#### Remarks

Synchronous version of `validate()`. Only works with synchronous validators.
Throws error if the schema uses async validators.

#### Throws

If document fails validation

#### Throws

If schema uses async validators

#### Example

```typescript
try {
  users.validateSync({ name: 'Alice', email: 'alice@example.com', age: 30, role: 'admin' });
  console.log('Document is valid');
} catch (err) {
  console.error('Validation failed:', err.message);
}
```
