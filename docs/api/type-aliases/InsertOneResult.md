[stratadb](../index.md) / InsertOneResult

# Type Alias: InsertOneResult&lt;T&gt;

```ts
type InsertOneResult<T> = T;
```

Defined in: [src/collection-types.ts:24](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/collection-types.ts#L24)

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
