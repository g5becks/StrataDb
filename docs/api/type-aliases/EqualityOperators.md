[stratadb](../index.md) / EqualityOperators

# Type Alias: EqualityOperators&lt;T&gt;

```ts
type EqualityOperators<T> = object;
```

Defined in: [src/query-types.ts:86](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/query-types.ts#L86)

Equality comparison operators.

## Remarks

These operators work with all data types and provide basic equality/inequality checks.

## Type Parameters

### T

`T`

The field type

## Properties

### $eq?

```ts
readonly $eq?: T;
```

Defined in: [src/query-types.ts:88](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/query-types.ts#L88)

Equal to the specified value

***

### $ne?

```ts
readonly $ne?: T;
```

Defined in: [src/query-types.ts:91](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/query-types.ts#L91)

Not equal to the specified value
