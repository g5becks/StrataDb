[stratadb](../index.md) / DeleteResult

# Type Alias: DeleteResult

```ts
type DeleteResult = object;
```

Defined in: [src/collection-types.ts:93](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-types.ts#L93)

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

Defined in: [src/collection-types.ts:95](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/collection-types.ts#L95)

Number of documents deleted
