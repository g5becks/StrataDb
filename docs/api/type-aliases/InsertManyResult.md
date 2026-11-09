[stratadb](../index.md) / InsertManyResult

# Type Alias: InsertManyResult&lt;T&gt;

```ts
type InsertManyResult<T> = object;
```

Defined in: [src/collection-types.ts:54](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/collection-types.ts#L54)

Result of inserting multiple documents into a collection.

## Remarks

Contains all successfully inserted documents with their generated IDs and count.
Since SQLite is ACID and local, if this function returns without throwing,
all inserts succeeded.

## Example

```typescript
const result = await users.insertMany([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' }
]);
console.log(`Inserted ${result.insertedCount} users`);
console.log('User IDs:', result.documents.map(d => d._id));
```

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

The document type

## Properties

### documents

```ts
readonly documents: readonly T[];
```

Defined in: [src/collection-types.ts:56](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/collection-types.ts#L56)

Array of inserted documents with their generated IDs

***

### insertedCount

```ts
readonly insertedCount: number;
```

Defined in: [src/collection-types.ts:59](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/collection-types.ts#L59)

Number of documents successfully inserted
