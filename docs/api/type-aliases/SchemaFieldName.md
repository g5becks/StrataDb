[stratadb](../index.md) / SchemaFieldName

# Type Alias: SchemaFieldName&lt;T&gt;

```ts
type SchemaFieldName<T> = Extract<keyof T | DocumentPath<T>, string>;
```

Defined in: [src/path-types.ts:49](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/path-types.ts#L49)

String field names accepted by checked schema declarations.

## Type Parameters

### T

`T`
