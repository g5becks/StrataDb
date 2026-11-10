[stratadb](../index.md) / QueryOptions

# Type Alias: QueryOptions&lt;T&gt;

```ts
type QueryOptions<T> = object;
```

Defined in: [src/query-options-types.ts:470](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/query-options-types.ts#L470)

Complete query options for controlling result set behavior.

## Remarks

Combines all query result control options:
- `sort`: Order results by one or more fields
- `limit`: Maximum number of results to return
- `skip`: Number of results to skip (for pagination)
- `select`: Array of fields to include (cleaner than projection)
- `omit`: Array of fields to exclude (cleaner than projection)
- `projection`: Which fields to include/exclude (MongoDB-style)

**Field selection options (mutually exclusive):**
- Use `select` to include specific fields: `{ select: ['name', 'email'] }`
- Use `omit` to exclude specific fields: `{ omit: ['password'] }`
- Use `projection` for MongoDB-style control: `{ projection: { name: 1 } }`
- Cannot combine `select`, `omit`, or `projection` in the same query

These options work together to enable:
- Pagination (limit + skip)
- Sorting (sort)
- Field selection (select, omit, or projection)
- Performance optimization (limit + select/omit)

## Example

```typescript
type User = Document<{
  name: string;
  email: string;
  age: number;
  status: 'active' | 'inactive';
  createdAt: Date;
}>;

// ✅ Pagination with sorting
const page2: QueryOptions<User> = {
  sort: { createdAt: -1 },  // Newest first
  limit: 20,                // 20 per page
  skip: 20                  // Skip first page
};

// ✅ Sorted results with field selection
const publicUsers: QueryOptions<User> = {
  sort: { name: 1 },
  projection: {
    name: 1,
    email: 1
    // Excludes age, status, createdAt
  }
};

// ✅ Top 10 most recent
const recent: QueryOptions<User> = {
  sort: { createdAt: -1 },
  limit: 10
};

// ✅ Complex pagination pattern
function getPage(pageNum: number, pageSize: number): QueryOptions<User> {
  return {
    sort: { createdAt: -1, name: 1 },
    limit: pageSize,
    skip: (pageNum - 1) * pageSize,
    projection: { name: 1, email: 1, status: 1 }
  };
}

// ✅ Performance optimization
const optimized: QueryOptions<User> = {
  limit: 100,              // Limit results
  projection: {            // Only needed fields
    name: 1,
    status: 1
  }
};

// Usage with collection
const results = await users.find(
  { status: 'active' },
  {
    sort: { createdAt: -1 },
    limit: 20,
    skip: 0,
    projection: { name: 1, email: 1 }
  }
);

// Pagination helper
async function fetchPage(page: number, perPage: number = 20) {
  return await users.find(
    {},
    {
      sort: { createdAt: -1 },
      limit: perPage,
      skip: (page - 1) * perPage
    }
  );
}

// ✅ Using select (cleaner field inclusion)
const withSelect: QueryOptions<User> = {
  select: ['name', 'email', 'status'],  // Only these fields + _id
  sort: { name: 1 }
};

// ✅ Using omit (exclude sensitive fields)
const withOmit: QueryOptions<User> = {
  omit: ['password'],  // All fields except password
  sort: { createdAt: -1 },
  limit: 10
};

// Usage with collection
const publicUsers = await users.find(
  { status: 'active' },
  { select: ['name', 'email'] }
);

const safeUsers = await users.find(
  {},
  { omit: ['password', 'ssn'] }
);
```

## Type Parameters

### T

`T`

The document type being queried

## Properties

### cursor?

```ts
readonly cursor?: CursorSpec;
```

Defined in: [src/query-options-types.ts:509](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/query-options-types.ts#L509)

Cursor-based pagination configuration.
Requires `sort` to be set. More efficient than skip/limit for large datasets.

***

### limit?

```ts
readonly limit?: number;
```

Defined in: [src/query-options-types.ts:475](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/query-options-types.ts#L475)

Maximum number of documents to return

***

### omit?

```ts
readonly omit?: OmitSpec<T>;
```

Defined in: [src/query-options-types.ts:490](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/query-options-types.ts#L490)

Array of fields to exclude from results.
Mutually exclusive with `select` and `projection`.

***

### projection?

```ts
readonly projection?: ProjectionSpec<T>;
```

Defined in: [src/query-options-types.ts:496](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/query-options-types.ts#L496)

Which fields to include (1) or exclude (0) from results.
Mutually exclusive with `select` and `omit`.

***

### retry?

```ts
readonly retry?: RetryOptions | false;
```

Defined in: [src/query-options-types.ts:522](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/query-options-types.ts#L522)

Retry configuration for this operation.
Overrides collection and database-level retry settings.
Pass `false` to disable retries for this operation.

***

### search?

```ts
readonly search?: TextSearchSpec<T>;
```

Defined in: [src/query-options-types.ts:503](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/query-options-types.ts#L503)

Multi-field text search configuration.
Searches across specified fields with OR logic (match any field).
Combined with filter using AND logic.

***

### select?

```ts
readonly select?: SelectSpec<T>;
```

Defined in: [src/query-options-types.ts:484](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/query-options-types.ts#L484)

Array of fields to include in results (plus _id).
Mutually exclusive with `omit` and `projection`.

***

### signal?

```ts
readonly signal?: AbortSignal;
```

Defined in: [src/query-options-types.ts:515](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/query-options-types.ts#L515)

AbortSignal for cancelling the operation.
When the signal is aborted, the operation will throw an AbortedError.

***

### skip?

```ts
readonly skip?: number;
```

Defined in: [src/query-options-types.ts:478](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/query-options-types.ts#L478)

Number of documents to skip (for pagination)

***

### sort?

```ts
readonly sort?: SortSpec<T>;
```

Defined in: [src/query-options-types.ts:472](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/query-options-types.ts#L472)

Sort order for results (MongoDB-style: 1 = asc, -1 = desc)
