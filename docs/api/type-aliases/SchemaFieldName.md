[stratadb](../index.md) / SchemaFieldName

# Type Alias: SchemaFieldName&lt;T&gt;

```ts
type SchemaFieldName<T> = Extract<keyof T | DocumentPath<T>, string>;
```

Defined in: [src/path-types.ts:49](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/path-types.ts#L49)

String field names accepted by checked schema declarations.

## Type Parameters

### T

`T`
