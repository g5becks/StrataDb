[stratadb](../index.md) / CursorSpec

# Type Alias: CursorSpec

```ts
type CursorSpec = object;
```

Defined in: [src/query-options-types.ts:395](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/query-options-types.ts#L395)

Cursor-based pagination specification for efficient large dataset navigation.

## Type Param

**T**

The document type being paginated

## Remarks

Cursor pagination provides consistent, efficient pagination that doesn't suffer
from the "shifting window" problem of skip/limit pagination. It's especially
beneficial for:

- **Large datasets**: O(1) vs O(n) for skip-based pagination
- **Real-time data**: New inserts don't affect pagination position
- **Consistent ordering**: Results remain stable across page requests

**How it works:**
- Use `after` to get items after a specific cursor (forward pagination)
- Use `before` to get items before a specific cursor (backward pagination)
- The cursor is the `_id` of the boundary document

**Requirements:**
- A `sort` option MUST be provided when using cursor pagination
- The `limit` option should be set to control page size

**Cursor value format:**
The cursor is simply the `_id` of the last/first document from the previous page.
The sort field value is extracted from the database for proper comparison.

## Example

```typescript
import type { CursorSpec, Document } from 'stratadb';

type User = Document<{
  name: string;
  createdAt: number;
}>;

// Forward pagination - get next page after cursor
const page2: CursorSpec = {
  after: 'user-abc123'  // _id of last item from page 1
};

// Usage with collection.find()
const firstPage = await users.find(
  { status: 'active' },
  { sort: { createdAt: -1 }, limit: 20 }
);

// Get next page using last item's _id as cursor
const lastItem = firstPage[firstPage.length - 1];
const secondPage = await users.find(
  { status: 'active' },
  {
    sort: { createdAt: -1 },
    limit: 20,
    cursor: { after: lastItem._id }
  }
);

// Backward pagination - get previous page
const firstItem = secondPage[0];
const backToFirstPage = await users.find(
  { status: 'active' },
  {
    sort: { createdAt: -1 },
    limit: 20,
    cursor: { before: firstItem._id }
  }
);
```

## Properties

### after?

```ts
readonly after?: string;
```

Defined in: [src/query-options-types.ts:400](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/query-options-types.ts#L400)

Get items after this cursor (forward pagination).
Value is the `_id` of the boundary document.

***

### before?

```ts
readonly before?: string;
```

Defined in: [src/query-options-types.ts:406](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/query-options-types.ts#L406)

Get items before this cursor (backward pagination).
Value is the `_id` of the boundary document.
