[stratadb](../index.md) / ComparisonOperator

# Type Alias: ComparisonOperator&lt;T&gt;

```ts
type ComparisonOperator<T> = T extends number | Date ? EqualityOperators<T> & OrderingOperators<T> & MembershipOperators<T> : EqualityOperators<T> & MembershipOperators<T>;
```

Defined in: [src/query-types.ts:111](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/query-types.ts#L111)

## Type Parameters

### T

`T`
