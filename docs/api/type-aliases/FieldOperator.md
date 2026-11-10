[stratadb](../index.md) / FieldOperator

# Type Alias: FieldOperator&lt;T&gt;

```ts
type FieldOperator<T> = T extends string ? ComparisonOperator<T> & StringOperator & ExistenceOperator : T extends readonly unknown[] ? ComparisonOperator<T> & ArrayOperator<T> & ExistenceOperator : ComparisonOperator<T> & ExistenceOperator;
```

Defined in: [src/query-types.ts:378](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/query-types.ts#L378)

Combined field operators for any field type.

## Type Parameters

### T

`T`

The field type

## Remarks

Combines all applicable operator types for a field. Uses conditional types
to only provide operators that make sense for the specific field type.

## Example

```typescript
type User = Document<{
  name: string;
  age: number;
  tags: string[];
  active: boolean;
  createdAt: Date;
}>;

// String field gets string operators
const nameField: FieldOperator<User['name']> = {
  $eq: 'Alice',
  $like: '%admin%',
  $startsWith: 'A'
};

// Number field gets comparison operators
const ageField: FieldOperator<User['age']> = {
  $gt: 18,
  $lte: 65
};

// Array field gets array operators
const tagsField: FieldOperator<User['tags']> = {
  $all: ['developer', 'typescript'],
  $size: 3
};

// Boolean field only gets basic operators
const activeField: FieldOperator<User['active']> = {
  $eq: true,
  $ne: false
};
```
