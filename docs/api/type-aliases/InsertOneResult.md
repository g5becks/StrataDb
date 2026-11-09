[stratadb](../index.md) / InsertOneResult

# Type Alias: InsertOneResult&lt;T&gt;

```ts
type InsertOneResult<T> = T;
```

Defined in: [src/collection-types.ts:32](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-types.ts#L32)

Result of inserting a single document into a collection.

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

The document type

## Remarks

Represents the inserted document with its generated ID.
Since SQLite is ACID and local, if this function returns without throwing,
the operation succeeded - no acknowledgment flag needed.

## Example

```typescript
const result = await users.insertOne({ name: 'Alice', email: 'alice@example.com' });
console.log(result._id); // Auto-generated UUID
```
