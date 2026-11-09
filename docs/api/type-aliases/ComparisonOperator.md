[stratadb](../index.md) / ComparisonOperator

# Type Alias: ComparisonOperator&lt;T&gt;

```ts
type ComparisonOperator<T> = T extends number | Date ? EqualityOperators<T> & OrderingOperators<T> & MembershipOperators<T> : EqualityOperators<T> & MembershipOperators<T>;
```

Defined in: [src/query-types.ts:111](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/query-types.ts#L111)

## Type Parameters

### T

`T`
