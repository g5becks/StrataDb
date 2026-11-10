[stratadb](../index.md) / ArrayValue

# Type Alias: ArrayValue&lt;T&gt;

```ts
type ArrayValue<T> = NonNullable<T> extends readonly infer Element[] ? Element : never;
```

Defined in: [src/core-types.ts:103](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/core-types.ts#L103)

Element type of a possibly nullable array; non-array inputs resolve to never.

## Type Parameters

### T

`T`
