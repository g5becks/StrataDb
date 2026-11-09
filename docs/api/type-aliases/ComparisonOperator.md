[stratadb](../index.md) / ComparisonOperator

# Type Alias: ComparisonOperator&lt;T&gt;

```ts
type ComparisonOperator<T> = T extends number | Date ? EqualityOperators<T> & OrderingOperators<T> & MembershipOperators<T> : EqualityOperators<T> & MembershipOperators<T>;
```

Defined in: [src/query-types.ts:111](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/query-types.ts#L111)

## Type Parameters

### T

`T`
