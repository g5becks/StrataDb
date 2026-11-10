[stratadb](../index.md) / BulkWriteResult

# Type Alias: BulkWriteResult&lt;T&gt;

```ts
type BulkWriteResult<T> = object;
```

Defined in: [src/core-types.ts:197](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/core-types.ts#L197)

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

Defined in: [src/core-types.ts:205](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/core-types.ts#L205)

Array of successfully inserted documents with IDs

***

### errors

```ts
readonly errors: readonly object[];
```

Defined in: [src/core-types.ts:208](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/core-types.ts#L208)

Array of errors for failed insertions

***

### insertedCount

```ts
readonly insertedCount: number;
```

Defined in: [src/core-types.ts:199](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/core-types.ts#L199)

Number of documents successfully inserted

***

### insertedIds

```ts
readonly insertedIds: readonly string[];
```

Defined in: [src/core-types.ts:202](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/core-types.ts#L202)

Array of generated IDs for successfully inserted documents
