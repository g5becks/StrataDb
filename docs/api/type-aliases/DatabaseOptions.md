[stratadb](../index.md) / DatabaseOptions

# Type Alias: DatabaseOptions

```ts
type DatabaseOptions = object;
```

Defined in: [src/database-types.ts:21](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/database-types.ts#L21)

Options for creating a StrataDB instance.

## Example

```typescript
const options: DatabaseOptions = {
  database: ':memory:',
  idGenerator: () => crypto.randomUUID(),
  onClose: () => console.log('Database closed')
};
const db = new StrataDB(options);
```

## Properties

### database

```ts
readonly database: string | SQLiteDatabase;
```

Defined in: [src/database-types.ts:26](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/database-types.ts#L26)

SQLite database path or ':memory:' for in-memory database.
Can also be an existing bun:sqlite Database instance.

***

### enableCache?

```ts
readonly enableCache?: boolean;
```

Defined in: [src/database-types.ts:76](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/database-types.ts#L76)

Enable query caching for all collections.

#### Remarks

When enabled, the query translator caches SQL templates for queries with the
same structure, improving performance for repeated queries at the cost of
memory usage (up to 500 cached query templates per collection).

**Performance improvements with cache enabled:**
- Simple queries: ~23% faster
- Range queries: ~70% faster
- Complex queries: ~55% faster

**Memory considerations:**
- Each collection maintains its own cache (up to 500 entries)
- Cache stores SQL strings and value extraction paths
- Use FIFO eviction when cache is full

**When to enable:**
- Applications with repeated query patterns
- High-throughput read operations
- When performance is more critical than memory usage

Individual collections can override this setting.

#### Default Value

```ts
false
```

#### See

CollectionOptions.enableCache for per-collection override

#### Example

```typescript
// Enable caching for all collections (opt-in for performance)
const db = new StrataDB({ database: ':memory:', enableCache: true });

// Disabled by default
const db = new StrataDB({ database: ':memory:' });
```

***

### idGenerator?

```ts
readonly idGenerator?: () => string;
```

Defined in: [src/database-types.ts:31](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/database-types.ts#L31)

Custom ID generator function. Defaults to crypto.randomUUID().

#### Returns

`string`

***

### onClose?

```ts
readonly onClose?: () => void;
```

Defined in: [src/database-types.ts:36](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/database-types.ts#L36)

Callback invoked when database is closed.

#### Returns

`void`

***

### retry?

```ts
readonly retry?: RetryOptions;
```

Defined in: [src/database-types.ts:97](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/database-types.ts#L97)

Default retry configuration for all database operations.

#### Remarks

Provides automatic retry with exponential backoff for transient errors.
Individual collections and operations can override this setting.

#### Default Value

```ts
No retries (retries: 0)
```

#### See

CollectionOptions.retry for per-collection override

#### Example

```typescript
const db = new StrataDB({
  database: 'app.db',
  retry: { retries: 3, minTimeout: 1000, maxTimeout: 30000 }
});
```
