[stratadb](../index.md) / ComparisonOperator

# Type Alias: ComparisonOperator&lt;T&gt;

```ts
type ComparisonOperator<T> = T extends number | Date ? EqualityOperators<T> & OrderingOperators<T> & MembershipOperators<T> : EqualityOperators<T> & MembershipOperators<T>;
```

Defined in: [src/query-types.ts:111](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/query-types.ts#L111)

## Type Parameters

### T

`T`
