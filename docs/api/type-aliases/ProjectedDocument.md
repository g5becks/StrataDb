[stratadb](../index.md) / ProjectedDocument

# Type Alias: ProjectedDocument&lt;T, K&gt;

```ts
type ProjectedDocument<T, K> = [K] extends [never] ? T : Pick<T, K | keyof T & "_id">;
```

Defined in: [src/query-projection-types.ts:242](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/query-projection-types.ts#L242)

Helper type to extract the result type based on projection options.
Returns Pick\<T, K | '_id'\> for select, Omit\<T, K\> for omit, or T for no projection.

## Type Parameters

### T

`T`

### K

`K` *extends* keyof `T` = `never`
