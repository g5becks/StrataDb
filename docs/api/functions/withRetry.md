[stratadb](../index.md) / withRetry

# Function: withRetry()

```ts
function withRetry<T>(operation, options?): Promise<T>;
```

Defined in: [src/retry-utils.ts:94](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/retry-utils.ts#L94)

Wraps an async operation with automatic retry logic.

## Type Parameters

### T

`T`

## Parameters

### operation

() => `Promise`&lt;`T`&gt;

The async function to execute with retry

### options?

`RetryableOptions`

Retry configuration options

## Returns

`Promise`&lt;`T`&gt;

The result of the operation

## Example

```typescript
const result = await withRetry(
  async () => db.execute('SELECT * FROM users'),
  { retries: 3, signal: abortController.signal }
)
```
