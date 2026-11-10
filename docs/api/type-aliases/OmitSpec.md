[stratadb](../index.md) / OmitSpec

# Type Alias: OmitSpec&lt;T&gt;

```ts
type OmitSpec<T> = readonly (keyof T)[];
```

Defined in: [src/query-projection-types.ts:236](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/query-projection-types.ts#L236)

Array-based field exclusion for query results.

## Type Parameters

### T

`T`

The document type being queried

## Remarks

Provides a cleaner, more intuitive alternative to `projection: { field: 0 }`
for specifying which fields to exclude from query results. Instead of using
MongoDB-style projection objects, simply pass an array of field names to omit.

**How it works:**
- All fields except the specified ones will be returned
- The `_id` field is always included (use projection to exclude it)
- Useful for excluding sensitive fields like passwords or tokens

**When to use `omit` vs `projection`:**
- Use `omit` when you want to exclude a few specific fields
- Use `projection` when you need more control (e.g., excluding `_id`)
- Cannot use both `omit` and `select` in the same query
- Cannot use `omit` with `projection` in the same query

## Example

```typescript
import type { OmitSpec, Document } from 'stratadb';

type User = Document<{
  name: string;
  email: string;
  password: string;
  ssn: string;
  age: number;
  status: 'active' | 'inactive';
}>;

// ✅ Omit sensitive fields
const safeFields: OmitSpec<User> = ['password', 'ssn'];

// ✅ Omit internal fields
const publicFields: OmitSpec<User> = ['password'];

// Usage with collection.find()
const users = await collection.find(
  { status: 'active' },
  { omit: ['password', 'ssn'] }
);
// Returns: [{ _id: '...', name: 'Alice', email: 'alice@...', age: 30, status: 'active' }, ...]

// ✅ Combining with sort and limit
const results = await collection.find(
  { status: 'active' },
  {
    omit: ['password'],
    sort: { createdAt: -1 },
    limit: 10
  }
);
```
