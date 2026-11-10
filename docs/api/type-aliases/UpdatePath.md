[stratadb](../index.md) / UpdatePath

# Type Alias: UpdatePath&lt;T&gt;

```ts
type UpdatePath<T> = SchemaFieldName<Omit<T, "_id" | "createdAt" | "updatedAt">>;
```

Defined in: [src/core-types.ts:99](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/core-types.ts#L99)

Mutable document paths used by atomic operators, excluding metadata.

## Type Parameters

### T

`T`
