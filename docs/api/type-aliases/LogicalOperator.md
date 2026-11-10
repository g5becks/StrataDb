[stratadb](../index.md) / LogicalOperator

# Type Alias: LogicalOperator&lt;T&gt;

```ts
type LogicalOperator<T> = object;
```

Defined in: [src/query-types.ts:450](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/query-types.ts#L450)

Logical operators for complex query composition.

## Remarks

Logical operators enable sophisticated query logic by combining multiple conditions.
These operators mirror MongoDB's logical query operators while maintaining full type safety.

All logical operators support recursive composition, allowing unlimited nesting depth
for complex business logic requirements.

## Example

```typescript
type User = Document<{
  name: string;
  age: number;
  status: 'active' | 'inactive' | 'pending';
  email: string;
}>;

// ✅ AND - All conditions must match
const activeAdults: LogicalOperator<User> = {
  $and: [
    { age: { $gte: 18 } },
    { status: 'active' }
  ]
};

// ✅ OR - At least one condition must match
const adminOrModerator: LogicalOperator<User> = {
  $or: [
    { name: { $startsWith: 'admin' } },
    { status: 'active' }
  ]
};

// ✅ NOR - None of the conditions must match
const notInactiveOrPending: LogicalOperator<User> = {
  $nor: [
    { status: 'inactive' },
    { status: 'pending' }
  ]
};

// ✅ NOT - Negates a single condition
const notAdult: LogicalOperator<User> = {
  $not: { age: { $gte: 18 } }
};

// ✅ Complex nested queries
const complexQuery: LogicalOperator<User> = {
  $and: [
    {
      $or: [
        { age: { $gt: 18 } },
        { status: 'active' }
      ]
    },
    {
      $not: { email: { $endsWith: '@spam.com' } }
    }
  ]
};
```

## Type Parameters

### T

`T`

The document type being queried

## Properties

### $and?

```ts
readonly $and?: readonly QueryFilter<T>[];
```

Defined in: [src/query-types.ts:452](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/query-types.ts#L452)

All conditions in the array must match (logical AND)

***

### $nor?

```ts
readonly $nor?: readonly QueryFilter<T>[];
```

Defined in: [src/query-types.ts:458](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/query-types.ts#L458)

None of the conditions in the array must match (logical NOR)

***

### $not?

```ts
readonly $not?: QueryFilter<T>;
```

Defined in: [src/query-types.ts:461](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/query-types.ts#L461)

Negates the given condition (logical NOT)

***

### $or?

```ts
readonly $or?: readonly QueryFilter<T>[];
```

Defined in: [src/query-types.ts:455](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/query-types.ts#L455)

At least one condition in the array must match (logical OR)
