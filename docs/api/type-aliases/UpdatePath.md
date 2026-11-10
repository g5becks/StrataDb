[stratadb](../index.md) / UpdatePath

# Type Alias: UpdatePath&lt;T&gt;

```ts
type UpdatePath<T> = SchemaFieldName<Omit<T, "_id" | "createdAt" | "updatedAt">>;
```

Defined in: [src/core-types.ts:99](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/core-types.ts#L99)

Mutable document paths used by atomic operators, excluding metadata.

## Type Parameters

### T

`T`
