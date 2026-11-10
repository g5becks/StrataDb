[stratadb](../index.md) / CollectionBatchContract

# Type Alias: CollectionBatchContract&lt;T&gt;

```ts
type CollectionBatchContract<T> = object;
```

Defined in: [src/collection-contract-batch.ts:10](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-batch.ts#L10)

Batch members of [Collection](Collection.md).

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

## Methods

### deleteMany()

```ts
deleteMany(filter, options?): Promise<DeleteResult>;
```

Defined in: [src/collection-contract-batch.ts:119](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-batch.ts#L119)

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

### insertMany()

```ts
insertMany(docs, options?): Promise<InsertManyResult<T>>;
```

Defined in: [src/collection-contract-batch.ts:44](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-batch.ts#L44)

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

### updateMany()

```ts
updateMany(
   filter,
   update,
   options?
): Promise<UpdateResult>;
```

Defined in: [src/collection-contract-batch.ts:85](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-contract-batch.ts#L85)

Update multiple documents matching the query filter.

#### Parameters

##### filter

[`QueryFilter`](QueryFilter.md)&lt;`T`&gt;

Query filter to find documents to update

##### update

[`DocumentUpdate`](DocumentUpdate.md)&lt;`T`&gt;

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
