[stratadb](../index.md) / DeleteResult

# Type Alias: DeleteResult

```ts
type DeleteResult = object;
```

Defined in: [src/collection-types.ts:101](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/collection-types.ts#L101)

Result of a delete operation.

## Remarks

Provides the count of documents deleted by the operation.
Since SQLite is ACID and local, if this function returns without throwing,
the operation succeeded.

## Example

```typescript
const result = await users.deleteMany({ status: 'inactive' });
console.log(`Deleted ${result.deletedCount} users`);
```

## Properties

### deletedCount

```ts
readonly deletedCount: number;
```

Defined in: [src/collection-types.ts:103](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/collection-types.ts#L103)

Number of documents deleted
