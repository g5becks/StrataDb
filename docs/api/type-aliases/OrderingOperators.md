[stratadb](../index.md) / OrderingOperators

# Type Alias: OrderingOperators&lt;T&gt;

```ts
type OrderingOperators<T> = T extends number | Date ? object : never;
```

Defined in: [src/query-types.ts:62](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/query-types.ts#L62)

Ordering comparison operators (greater than, less than).

## Type Parameters

### T

`T`

The field type (must be number or Date)

## Remarks

These operators are only available for types that support natural ordering:
numbers and dates. This prevents nonsensical comparisons like checking if
one string is "greater than" another string.
