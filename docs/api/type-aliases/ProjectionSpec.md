[stratadb](../index.md) / ProjectionSpec

# Type Alias: ProjectionSpec&lt;T&gt;

```ts
type ProjectionSpec<T> = { readonly [K in keyof T]?: 1 | 0 };
```

Defined in: [src/query-options-types.ts:118](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/query-options-types.ts#L118)

Projection specification for field selection in query results.

## Type Parameters

### T

`T`

The document type being queried

## Remarks

Controls which fields are included in or excluded from query results.
Uses MongoDB-style projection syntax:
- `1` or `true`: Include the field
- `0` or `false`: Exclude the field

**Important rules:**
- Cannot mix inclusion and exclusion (except for `id` field)
- Either specify fields to include OR fields to exclude
- The `id` field is always included unless explicitly excluded

## Example

```typescript
type User = Document<{
  name: string;
  email: string;
  password: string;
  age: number;
  createdAt: Date;
}>;

// ✅ Include specific fields (exclude all others)
const publicFields: ProjectionSpec<User> = {
  name: 1,
  email: 1,
  age: 1
  // password, createdAt excluded
};

// ✅ Exclude specific fields (include all others)
const withoutPassword: ProjectionSpec<User> = {
  password: 0
  // name, email, age, createdAt included
};

// ✅ Exclude multiple fields
const minimalUser: ProjectionSpec<User> = {
  password: 0,
  createdAt: 0
};

// ✅ Exclude id field
const noId: ProjectionSpec<User> = {
  id: 0,
  name: 1,
  email: 1
};

// Usage with collection
const users = await collection.find(
  { status: 'active' },
  { projection: { name: 1, email: 1 } }
);
```
