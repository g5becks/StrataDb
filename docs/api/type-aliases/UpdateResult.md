[stratadb](../index.md) / UpdateResult

# Type Alias: UpdateResult

```ts
type UpdateResult = object;
```

Defined in: [src/collection-types.ts:79](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/collection-types.ts#L79)

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

Defined in: [src/collection-types.ts:81](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/collection-types.ts#L81)

Number of documents that matched the filter

***

### modifiedCount

```ts
readonly modifiedCount: number;
```

Defined in: [src/collection-types.ts:84](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/collection-types.ts#L84)

Number of documents that were actually modified
