[stratadb](../index.md) / SchemaFieldName

# Type Alias: SchemaFieldName&lt;T&gt;

```ts
type SchemaFieldName<T> = Extract<keyof T | DocumentPath<T>, string>;
```

Defined in: [src/path-types.ts:49](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/path-types.ts#L49)

String field names accepted by checked schema declarations.

## Type Parameters

### T

`T`
