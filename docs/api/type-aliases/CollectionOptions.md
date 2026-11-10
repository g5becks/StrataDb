[stratadb](../index.md) / CollectionOptions

# Type Alias: CollectionOptions

```ts
type CollectionOptions = object;
```

Defined in: [src/database-types.ts:127](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/database-types.ts#L127)

Options for creating a collection.

## Remarks

Collection-specific options that can override database-level defaults.

## Example

```typescript
// Override database-level cache setting for a specific collection
const users = db.collection('users', userSchema, { enableCache: false });
```

## Properties

### enableCache?

```ts
readonly enableCache?: boolean;
```

Defined in: [src/database-types.ts:162](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/database-types.ts#L162)

Enable query caching for this collection.

#### Remarks

Overrides the database-level `enableCache` setting for this specific collection.
When enabled, the query translator caches SQL templates for queries with the
same structure, improving performance for repeated queries at the cost of
memory usage (up to 500 cached query templates).

**Use cases for enabling cache on specific collections:**
- Collections with frequent repeated queries (e.g., user lookups)
- High-read collections in performance-critical paths
- Collections with stable query patterns

**Use cases for disabling cache on specific collections:**
- Log/audit collections with varied queries
- Low-frequency access collections
- Memory-constrained environments

#### Default Value

```ts
Inherits from database-level setting (false by default)
```

#### See

[DatabaseOptions.enableCache](DatabaseOptions.md#enablecache) for global default

#### Example

```typescript
// Enable cache for a high-traffic collection
const users = db.collection('users', userSchema, { enableCache: true });

// Explicitly disable cache for a collection
const logs = db.collection('logs', logSchema, { enableCache: false });
```

***

### retry?

```ts
readonly retry?: RetryOptions | false;
```

Defined in: [src/database-types.ts:186](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/database-types.ts#L186)

Retry configuration for this collection.

#### Remarks

Overrides the database-level `retry` setting for this specific collection.
Pass `false` to explicitly disable retries for this collection.

#### Default Value

```ts
Inherits from database-level setting (no retries by default)
```

#### See

[DatabaseOptions.retry](DatabaseOptions.md#retry) for global default

#### Example

```typescript
// Enable retries for a specific collection
const users = db.collection('users', userSchema, {
  retry: { retries: 3, minTimeout: 1000 }
});

// Disable retries for a collection
const logs = db.collection('logs', logSchema, { retry: false });
```

***

### statementCacheSize?

```ts
readonly statementCacheSize?: number;
```

Defined in: [src/database-types.ts:129](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/database-types.ts#L129)

Override the database prepared-statement LRU capacity (default 64).
