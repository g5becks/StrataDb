[stratadb](../index.md) / generateId

# Function: generateId()

```ts
function generateId(): string;
```

Defined in: [src/id-generator.ts:68](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/id-generator.ts#L68)

Default ID generator for StrataDB documents.

## Returns

`string`

A unique, time-sortable UUID v7 string

## Remarks

Uses Bun's `randomUUIDv7()` implementation which generates UUID version 7 identifiers.
UUID v7 provides several important properties for database primary keys:

**Time-Sortable:**
- First 48 bits encode Unix timestamp in milliseconds
- Documents inserted later will have lexicographically greater IDs
- Enables efficient B-tree indexing and range queries

**Globally Unique:**
- Remaining bits contain cryptographically random data
- Collision probability is astronomically low (2^-74 per millisecond)
- Safe for distributed systems without coordination

**URL-Safe & Compact:**
- Standard UUID format: `018c3f7e-8b5d-7a3c-9f2e-1a4b5c6d7e8f`
- 36 characters including hyphens
- Safe for use in URLs, filenames, and APIs

**Performance:**
- Stateless function with no memory allocation
- Safe for concurrent use across multiple threads/workers
- Faster than alternatives requiring coordination (e.g., database sequences)

**Monotonicity:**
- IDs generated within the same millisecond are randomly ordered
- IDs from different milliseconds are strictly ordered by time
- Provides "best-effort" monotonicity for most use cases

## Examples

```typescript
const id1 = generateId();
const id2 = generateId();

// IDs are unique
console.log(id1 !== id2); // true

// IDs from different times are sortable
await new Promise(resolve => setTimeout(resolve, 2));
const id3 = generateId();
console.log(id1 < id3); // true (lexicographic comparison)

// Format: standard UUID v7
console.log(id1); // "018c3f7e-8b5d-7a3c-9f2e-1a4b5c6d7e8f"
```

```typescript
// Using with custom ID generator
import { StrataDB } from 'stratadb';

const db = new StrataDB(':memory:', {
  idGenerator: () => `custom-${Date.now()}-${Math.random()}`
});

// Or use the default
const db2 = new StrataDB(':memory:'); // Uses generateId internally
```

## See

 - [RFC 9562 - UUID Version 7](https://www.rfc-editor.org/rfc/rfc9562.html#section-5.7)
 - [Bun.randomUUIDv7()](https://bun.sh/docs/api/utils#bun-randomuuidv7)
