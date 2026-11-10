[stratadb](../index.md) / TextSearchSpec

# Type Alias: TextSearchSpec&lt;T&gt;

```ts
type TextSearchSpec<T> = object;
```

Defined in: [src/query-options-types.ts:92](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/query-options-types.ts#L92)

Text search configuration for literal multi-field substring searching.

## Remarks

Enables searching across multiple document fields simultaneously using
literal text with optional ASCII case folding. This supports search
boxes, autocomplete, and filtering features.

**How it works:**
- Percent, underscore and backslash in `text` remain literal
- All specified `fields` are searched with OR logic (match any field)
- By default, search folds ASCII case; non-ASCII case is preserved
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

Defined in: [src/query-options-types.ts:103](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/query-options-types.ts#L103)

Whether to perform case-sensitive matching. Default: false (case-insensitive)

***

### fields

```ts
readonly fields: readonly (keyof T | string)[];
```

Defined in: [src/query-options-types.ts:100](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/query-options-types.ts#L100)

Fields to search. Use field names for top-level, dot notation for nested.
All fields are searched with OR logic (match any).

***

### text

```ts
readonly text: string;
```

Defined in: [src/query-options-types.ts:94](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/query-options-types.ts#L94)

Literal substring text; percent, underscore and backslash stay literal
