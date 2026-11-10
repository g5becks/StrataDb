[stratadb](../index.md) / UpdateResult

# Type Alias: UpdateResult

```ts
type UpdateResult = object;
```

Defined in: [src/collection-types.ts:71](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-types.ts#L71)

Result of an update operation.

## Remarks

Provides statistics about documents matched and modified by the update.
Since SQLite is ACID and local, if this function returns without throwing,
the operation succeeded.

## Example

```typescript
const result = await users.updateMany(
  { status: 'inactive' },
  { $set: { status: 'deleted' } }
);
console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
```

## Properties

### matchedCount

```ts
readonly matchedCount: number;
```

Defined in: [src/collection-types.ts:73](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-types.ts#L73)

Number of documents that matched the filter

***

### modifiedCount

```ts
readonly modifiedCount: number;
```

Defined in: [src/collection-types.ts:76](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-types.ts#L76)

Number of documents that were actually modified
