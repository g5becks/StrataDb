[stratadb](../index.md) / BulkWriteResult

# Type Alias: BulkWriteResult&lt;T&gt;

```ts
type BulkWriteResult<T> = object;
```

Defined in: [src/core-types.ts:201](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/core-types.ts#L201)

Result type for bulk insert operations.

## Remarks

Provides detailed results for `insertMany()` operations, including:
- Successfully inserted documents with generated IDs
- Errors for documents that failed validation or insertion
- Original document inputs for failed operations

When `ordered: false`, insertion continues despite errors.
When `ordered: true`, insertion stops at the first error.

## Example

```typescript
const result = await users.insertMany([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'invalid' },  // Validation error
  { name: 'Charlie', email: 'charlie@example.com' }
], { ordered: false });

console.log(result.insertedCount);  // 2 (Alice and Charlie)
console.log(result.errors.length);  // 1 (Bob failed)
console.log(result.errors[0].index);  // 1
console.log(result.errors[0].error);  // ValidationError
```

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

The document type extending Document

## Properties

### documents

```ts
readonly documents: readonly T[];
```

Defined in: [src/core-types.ts:209](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/core-types.ts#L209)

Array of successfully inserted documents with IDs

***

### errors

```ts
readonly errors: readonly object[];
```

Defined in: [src/core-types.ts:212](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/core-types.ts#L212)

Array of errors for failed insertions

***

### insertedCount

```ts
readonly insertedCount: number;
```

Defined in: [src/core-types.ts:203](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/core-types.ts#L203)

Number of documents successfully inserted

***

### insertedIds

```ts
readonly insertedIds: readonly string[];
```

Defined in: [src/core-types.ts:206](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/core-types.ts#L206)

Array of generated IDs for successfully inserted documents
