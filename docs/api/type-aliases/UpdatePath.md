[stratadb](../index.md) / UpdatePath

# Type Alias: UpdatePath&lt;T&gt;

```ts
type UpdatePath<T> = SchemaFieldName<Omit<T, "_id" | "createdAt" | "updatedAt">>;
```

Defined in: [src/core-types.ts:99](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/core-types.ts#L99)

Mutable document paths used by atomic operators, excluding metadata.

## Type Parameters

### T

`T`
