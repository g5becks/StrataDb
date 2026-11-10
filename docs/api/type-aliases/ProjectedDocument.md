[stratadb](../index.md) / ProjectedDocument

# Type Alias: ProjectedDocument&lt;T, K&gt;

```ts
type ProjectedDocument<T, K> = [K] extends [never] ? T : Pick<T, K | keyof T & "_id">;
```

Defined in: [src/query-options-types.ts:836](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/query-options-types.ts#L836)

Helper type to extract the result type based on projection options.
Returns Pick\<T, K | '_id'\> for select, Omit\<T, K\> for omit, or T for no projection.

## Type Parameters

### T

`T`

### K

`K` *extends* keyof `T` = `never`
