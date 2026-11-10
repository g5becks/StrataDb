[stratadb](../index.md) / SchemaFieldName

# Type Alias: SchemaFieldName&lt;T&gt;

```ts
type SchemaFieldName<T> = Extract<keyof T | DocumentPath<T>, string>;
```

Defined in: [src/path-types.ts:49](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/path-types.ts#L49)

String field names accepted by checked schema declarations.

## Type Parameters

### T

`T`
