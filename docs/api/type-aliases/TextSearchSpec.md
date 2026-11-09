[stratadb](../index.md) / TextSearchSpec

# Type Alias: TextSearchSpec&lt;T&gt;

```ts
type TextSearchSpec<T> = object;
```

Defined in: [src/query-options-types.ts:311](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/query-options-types.ts#L311)

Text search configuration for multi-field full-text searching.

## Remarks

Enables searching across multiple document fields simultaneously using
case-insensitive LIKE patterns. This is useful for implementing search
boxes, autocomplete, and filtering features.

**How it works:**
- The `text` value is wrapped with `%` wildcards for substring matching
- All specified `fields` are searched with OR logic (match any field)
- By default, search is case-insensitive (uses SQLite COLLATE NOCASE)
- Set `caseSensitive: true` for exact case matching

**Field paths:**
- Use field names directly for top-level fields: `['name', 'email']`
- Use dot notation for nested fields: `['profile.bio', 'address.city']`
- Mix both: `['name', 'profile.bio', 'tags']`

**Performance considerations:**
- Indexed fields are searched more efficiently
- Searching many fields increases query complexity
- For large datasets, consider using dedicated search solutions

## Example

```typescript
import type { TextSearchSpec, Document } from 'stratadb';

type User = Document<{
  name: string;
  email: string;
  profile: {
    bio: string;
    company: string;
  };
}>;

// Search across name and email
const simpleSearch: TextSearchSpec<User> = {
  text: 'alice',
  fields: ['name', 'email']
};

// Search including nested fields
const nestedSearch: TextSearchSpec<User> = {
  text: 'engineer',
  fields: ['name', 'profile.bio', 'profile.company']
};

// Case-sensitive search
const caseSensitiveSearch: TextSearchSpec<User> = {
  text: 'Alice',
  fields: ['name'],
  caseSensitive: true
};

// Usage with collection.find()
const results = await users.find(
  { status: 'active' },
  {
    search: {
      text: 'alice',
      fields: ['name', 'email']
    },
    limit: 10
  }
);
```

## Type Parameters

### T

`T`

The document type being searched

## Properties

### caseSensitive?

```ts
readonly caseSensitive?: boolean;
```

Defined in: [src/query-options-types.ts:322](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/query-options-types.ts#L322)

Whether to perform case-sensitive matching. Default: false (case-insensitive)

***

### fields

```ts
readonly fields: readonly (keyof T | string)[];
```

Defined in: [src/query-options-types.ts:319](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/query-options-types.ts#L319)

Fields to search. Use field names for top-level, dot notation for nested.
All fields are searched with OR logic (match any).

***

### text

```ts
readonly text: string;
```

Defined in: [src/query-options-types.ts:313](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/query-options-types.ts#L313)

The search text to find (wrapped with % wildcards for substring matching)
