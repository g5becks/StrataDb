[stratadb](../index.md) / SchemaFieldName

# Type Alias: SchemaFieldName&lt;T&gt;

```ts
type SchemaFieldName<T> = Extract<keyof T | DocumentPath<T>, string>;
```

Defined in: [src/path-types.ts:49](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/path-types.ts#L49)

String field names accepted by checked schema declarations.

## Type Parameters

### T

`T`
