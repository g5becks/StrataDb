[stratadb](../index.md) / SortSpec

# Type Alias: SortSpec&lt;T&gt;

```ts
type SortSpec<T> = { readonly [K in keyof T]?: 1 | -1 };
```

Defined in: [src/query-options-types.ts:54](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/query-options-types.ts#L54)

Sort specification for query result ordering.

## Type Parameters

### T

`T`

The document type being queried

## Remarks

Defines sort order for query results using MongoDB-style sort syntax.
Each field can be sorted in ascending (1) or descending (-1) order.
Multiple fields can be specified for multi-level sorting.

Sort order matters: fields are sorted left-to-right as specified.

## Example

```typescript
type User = Document<{
  name: string;
  age: number;
  createdAt: Date;
  status: 'active' | 'inactive';
}>;

// ✅ Single field sort
const byAge: SortSpec<User> = {
  age: 1  // Ascending order
};

// ✅ Descending order
const byNewest: SortSpec<User> = {
  createdAt: -1  // Most recent first
};

// ✅ Multi-field sort
const byStatusThenAge: SortSpec<User> = {
  status: 1,   // First by status (ascending)
  age: -1      // Then by age (descending)
};

// ✅ Complex sort
const complexSort: SortSpec<User> = {
  status: 1,      // Active users first
  createdAt: -1,  // Then newest first
  name: 1         // Then alphabetically
};

// Usage with collection
const results = await users.find(
  { status: 'active' },
  { sort: { createdAt: -1, name: 1 } }
);
```
