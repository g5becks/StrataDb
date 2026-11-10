[stratadb](../index.md) / MembershipOperators

# Type Alias: MembershipOperators&lt;T&gt;

```ts
type MembershipOperators<T> = object;
```

Defined in: [src/query-types.ts:103](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/query-types.ts#L103)

Membership comparison operators.

## Remarks

These operators check if a value is included in or excluded from a set of values.
The array type is enforced to match the field type for type safety.

## Type Parameters

### T

`T`

The field type

## Properties

### $in?

```ts
readonly $in?: readonly T[];
```

Defined in: [src/query-types.ts:105](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/query-types.ts#L105)

Value is included in the specified array

***

### $nin?

```ts
readonly $nin?: readonly T[];
```

Defined in: [src/query-types.ts:108](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/query-types.ts#L108)

Value is not included in the specified array
