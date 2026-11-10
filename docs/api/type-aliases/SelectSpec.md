[stratadb](../index.md) / SelectSpec

# Type Alias: SelectSpec&lt;T&gt;

```ts
type SelectSpec<T> = readonly (keyof T)[];
```

Defined in: [src/query-projection-types.ts:176](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/query-projection-types.ts#L176)

Array-based field selection for query results (inclusion).

## Type Parameters

### T

`T`

The document type being queried

## Remarks

Provides a cleaner, more intuitive alternative to `projection: { field: 1 }`
for specifying which fields to include in query results. Instead of using
MongoDB-style projection objects, simply pass an array of field names.

**How it works:**
- Only the specified fields (plus `_id`) will be returned
- All other fields are excluded from the result
- The `_id` field is always included automatically

**When to use `select` vs `projection`:**
- Use `select` when you want to include specific fields (most common case)
- Use `projection` when you need more control (e.g., excluding `_id`)
- Cannot use both `select` and `projection` in the same query

## Example

```typescript
import type { SelectSpec, Document } from 'stratadb';

type User = Document<{
  name: string;
  email: string;
  password: string;
  age: number;
  status: 'active' | 'inactive';
}>;

// ✅ Select specific fields to return
const publicFields: SelectSpec<User> = ['name', 'email', 'age'];

// ✅ Minimal fields for list view
const listFields: SelectSpec<User> = ['name', 'status'];

// Usage with collection.find()
const users = await collection.find(
  { status: 'active' },
  { select: ['name', 'email'] }
);
// Returns: [{ _id: '...', name: 'Alice', email: 'alice@example.com' }, ...]

// ✅ Combining with sort and limit
const results = await collection.find(
  { status: 'active' },
  {
    select: ['name', 'email', 'createdAt'],
    sort: { createdAt: -1 },
    limit: 10
  }
);
```
