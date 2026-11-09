[stratadb](../index.md) / ProjectedDocument

# Type Alias: ProjectedDocument&lt;T, K&gt;

```ts
type ProjectedDocument<T, K> = [K] extends [never] ? T : Pick<T, K | keyof T & "_id">;
```

Defined in: [src/query-options-types.ts:832](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/query-options-types.ts#L832)

Helper type to extract the result type based on projection options.
Returns Pick\<T, K | '_id'\> for select, Omit\<T, K\> for omit, or T for no projection.

## Type Parameters

### T

`T`

### K

`K` *extends* keyof `T` = `never`
