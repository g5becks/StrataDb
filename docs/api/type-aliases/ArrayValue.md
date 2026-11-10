[stratadb](../index.md) / ArrayValue

# Type Alias: ArrayValue&lt;T&gt;

```ts
type ArrayValue<T> = NonNullable<T> extends readonly infer Element[] ? Element : never;
```

Defined in: [src/core-types.ts:103](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/core-types.ts#L103)

Element type of a possibly nullable array; non-array inputs resolve to never.

## Type Parameters

### T

`T`
