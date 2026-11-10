[stratadb](../index.md) / InsertManyResult

# Type Alias: InsertManyResult&lt;T&gt;

```ts
type InsertManyResult<T> = object;
```

Defined in: [src/collection-types.ts:46](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/collection-types.ts#L46)

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

Defined in: [src/collection-types.ts:48](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/collection-types.ts#L48)

Array of inserted documents with their generated IDs

***

### insertedCount

```ts
readonly insertedCount: number;
```

Defined in: [src/collection-types.ts:51](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/collection-types.ts#L51)

Number of documents successfully inserted
