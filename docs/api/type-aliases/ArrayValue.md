[stratadb](../index.md) / ArrayValue

# Type Alias: ArrayValue&lt;T&gt;

```ts
type ArrayValue<T> = NonNullable<T> extends readonly infer Element[] ? Element : never;
```

Defined in: [src/core-types.ts:103](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/core-types.ts#L103)

Element type of a possibly nullable array; non-array inputs resolve to never.

## Type Parameters

### T

`T`
