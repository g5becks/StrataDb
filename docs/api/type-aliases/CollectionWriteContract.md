[stratadb](../index.md) / CollectionWriteContract

# Type Alias: CollectionWriteContract&lt;T&gt;

```ts
type CollectionWriteContract<T> = object;
```

Defined in: [src/collection-contract-write.ts:6](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-contract-write.ts#L6)

Write members of [Collection](Collection.md).

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

## Methods

### deleteOne()

```ts
deleteOne(filter, options?): Promise<boolean>;
```

Defined in: [src/collection-contract-write.ts:201](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-contract-write.ts#L201)

Delete a single document by ID or filter.

#### Parameters

##### filter

`string` \| [`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Document ID (string) or query filter

##### options?

###### includeDocument?

`boolean`

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

### findOneAndDelete()

```ts
findOneAndDelete(filter, options?): Promise<T | null>;
```

Defined in: [src/collection-contract-write.ts:252](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-contract-write.ts#L252)

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

Defined in: [src/collection-contract-write.ts:377](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-contract-write.ts#L377)

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

Defined in: [src/collection-contract-write.ts:315](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-contract-write.ts#L315)

Find and update a single document atomically.

#### Parameters

##### filter

`string` \| [`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Document ID (string) or query filter

##### update

[`DocumentUpdate`](DocumentUpdate.md)&lt;`T`&gt;

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

### insertOne()

```ts
insertOne(doc, options?): Promise<T>;
```

Defined in: [src/collection-contract-write.ts:50](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-contract-write.ts#L50)

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
- `_id`: Configured generator (UUID v7 by default)
- `createdAt`: Current timestamp
- `updatedAt`: Current timestamp; metadata visibility follows timestamps

**Validation:**
If validation fails, throws `ValidationError` with details.

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

### replaceOne()

```ts
replaceOne(
   filter,
   doc,
   options?
): Promise<T | null>;
```

Defined in: [src/collection-contract-write.ts:159](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-contract-write.ts#L159)

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

### updateOne()

```ts
updateOne(
   filter,
   update,
   options?
): Promise<T | null>;
```

Defined in: [src/collection-contract-write.ts:98](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-contract-write.ts#L98)

Update a single document matching the query filter or ID.

#### Parameters

##### filter

`string` \| [`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Document ID or query filter to find the document to update

##### update

[`DocumentUpdate`](DocumentUpdate.md)&lt;`T`&gt;

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
