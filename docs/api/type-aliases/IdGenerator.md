[stratadb](../index.md) / IdGenerator

# Type Alias: IdGenerator

```ts
type IdGenerator = () => string;
```

Defined in: [src/id-generator.ts:111](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/id-generator.ts#L111)

Type definition for custom ID generator functions.

## Returns

`string`

## Remarks

Custom ID generators must return unique string identifiers.
While not required, time-sortable IDs are recommended for optimal
database performance.

**Requirements:**
- Must return a unique string for each invocation
- Should be stateless (no mutable state)
- Must be safe for concurrent use
- Strings should be reasonably compact (\< 100 chars recommended)

**Recommendations:**
- Include timestamp component for sortability
- Include random component for uniqueness
- Avoid special characters that require URL encoding
- Consider using UUID v7, ULID, or similar standards

## Example

```typescript
// Simple timestamp-based ID
const customGenerator: IdGenerator = () => {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

// ULID-style (would need ulid library)
const ulidGenerator: IdGenerator = () => {
  return ulid(); // Lexicographically sortable, 26 chars
};

// Sequential numeric (NOT recommended for distributed systems)
let counter = 0;
const sequentialGenerator: IdGenerator = () => {
  return String(++counter); // NOT thread-safe!
};
```
