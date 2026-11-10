[stratadb](../index.md) / StringOperator

# Type Alias: StringOperator

```ts
type StringOperator = object;
```

Defined in: [src/query-types.ts:163](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/query-types.ts#L163)

String-specific query operators for pattern matching.

## Remarks

These operators provide MongoDB-like string matching capabilities with full
type safety. Only available for string fields to prevent runtime errors.

For complex pattern matching that would typically use regular expressions,
consider using these alternatives:
- `$like`: For SQL-style pattern matching with % wildcards (case-sensitive)
- `$ilike`: For SQL-style patterns with ASCII case folding
- `$contains`: For case-sensitive literal substring containment
- `$startsWith`: For case-sensitive literal prefix matching
- `$endsWith`: For case-sensitive literal suffix matching

## Example

```typescript
// ✅ Valid string queries
const emailQuery: StringOperator = {
  $like: '%@example.com',     // SQL LIKE pattern (case-sensitive)
  $startsWith: 'admin',      // Starts with prefix
  $endsWith: '@domain.com'   // Ends with suffix
};

// ✅ Case-insensitive pattern matching
const caseInsensitiveQuery: StringOperator = {
  $ilike: '%alice%'          // Matches 'Alice', 'ALICE', 'alice', etc.
};

// ✅ Literal substring containment
const containsQuery: StringOperator = {
  $contains: 'admin'         // Equivalent to: $like: '%admin%'
};

// ✅ Pattern matching alternatives
const namePatterns: StringOperator = {
  $startsWith: 'A',          // Names starting with 'A'
  $endsWith: 'son',          // Names ending with 'son'
  $contains: 'john'          // Contains 'john' anywhere
};

// ✅ Combining multiple string conditions
const complexStringQuery: StringOperator = {
  $startsWith: 'Dr.',
  $ilike: '%phd%'            // Case-insensitive search for 'PhD'
};
```

## Properties

### $contains?

```ts
readonly $contains?: string;
```

Defined in: [src/query-types.ts:227](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/query-types.ts#L227)

Substring containment check (case-sensitive).

#### Remarks

Checks for a literal substring with exact case. Percent, underscore and
backslash are ordinary characters; the translator uses SQLite instr().

For case-insensitive containment checks, combine with `$ilike`:
`{ field: { $ilike: '%value%' } }`

#### Example

```typescript
// Find documents where description contains 'important'
const docs = await collection.find({
  description: { $contains: 'important' }
});
// Equivalent to: { description: { $like: '%important%' } }

// Find users with a specific domain in their email
const users = await collection.find({
  email: { $contains: '@example' }
});
// Matches: 'user@example.com', 'admin@example.org'
// Does NOT match: 'user@Example.com' (case-sensitive)

// Combine with other string operators
const filtered = await collection.find({
  title: { $contains: 'guide', $startsWith: 'TypeScript' }
});
```

***

### $endsWith?

```ts
readonly $endsWith?: string;
```

Defined in: [src/query-types.ts:233](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/query-types.ts#L233)

String ends with the specified suffix

***

### $ilike?

```ts
readonly $ilike?: string;
```

Defined in: [src/query-types.ts:194](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/query-types.ts#L194)

SQL-style LIKE pattern matching (case-insensitive).

#### Remarks

The `$ilike` operator performs case-insensitive pattern matching using
ASCII case folding. Use the same `%` and `_` wildcards as `$like`:
- `%` matches zero or more characters
- `_` matches exactly one character

This is particularly useful for user-facing search features where users
expect case-insensitive matching.

#### Example

```typescript
// Find users with name containing 'alice' (any case)
const users = await collection.find({
  name: { $ilike: '%alice%' }
});
// Matches: 'Alice Smith', 'ALICE', 'alice jones', 'AlIcE'

// Case-insensitive email domain search
const gmailUsers = await collection.find({
  email: { $ilike: '%@gmail.com' }
});
// Matches: 'user@Gmail.com', 'USER@GMAIL.COM', 'user@gmail.com'
```

***

### $like?

```ts
readonly $like?: string;
```

Defined in: [src/query-types.ts:165](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/query-types.ts#L165)

SQL-style LIKE pattern matching (case-sensitive)

***

### $startsWith?

```ts
readonly $startsWith?: string;
```

Defined in: [src/query-types.ts:230](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/query-types.ts#L230)

String starts with the specified prefix
