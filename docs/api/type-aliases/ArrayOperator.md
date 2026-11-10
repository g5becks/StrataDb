[stratadb](../index.md) / ArrayOperator

# Type Alias: ArrayOperator&lt;T&gt;

```ts
type ArrayOperator<T> = T extends readonly infer U[] ? object : never;
```

Defined in: [src/query-types.ts:281](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/query-types.ts#L281)

Array-specific query operators for MongoDB-like array operations.

## Type Parameters

### T

`T`

The field type (must be an array)

## Remarks

These operators provide powerful array querying capabilities with type safety.
The array element type is automatically inferred using conditional type inference.
Only available for array types to prevent runtime errors.

## Example

```typescript
// Array field type
type User = Document<{
  tags: string[];
  scores: number[];
  contacts: { name: string; email: string; }[];
}>;

// ✅ Valid array queries
const tagsQuery: ArrayOperator<User['tags']> = {
  $all: ['developer', 'typescript'],  // Contains all specified values
  $size: 3,                           // Exactly 3 elements
  $index: 0                           // First element equals 'admin'
};

const scoresQuery: ArrayOperator<User['scores']> = {
  $all: [90, 95, 100],
  $size: 5
};

// Nested object array query
const contactsQuery: ArrayOperator<User['contacts']> = {
  $elemMatch: {
    name: 'Alice',
    email: { $endsWith: '@example.com' }
  }
};

// ❌ TypeScript errors
const invalidQuery: ArrayOperator<User['name']> = {
  $all: ['value']  // Error: User['name'] is string, not array
};
```
