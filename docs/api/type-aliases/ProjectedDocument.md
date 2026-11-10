[stratadb](../index.md) / ProjectedDocument

# Type Alias: ProjectedDocument&lt;T, K&gt;

```ts
type ProjectedDocument<T, K> = [K] extends [never] ? T : Pick<T, K | keyof T & "_id">;
```

Defined in: [src/query-projection-types.ts:242](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/query-projection-types.ts#L242)

Helper type to extract the result type based on projection options.
Returns Pick\<T, K | '_id'\> for select, Omit\<T, K\> for omit, or T for no projection.

## Type Parameters

### T

`T`

### K

`K` *extends* keyof `T` = `never`
