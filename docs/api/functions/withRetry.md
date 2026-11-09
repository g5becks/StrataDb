[stratadb](../index.md) / withRetry

# Function: withRetry()

```ts
function withRetry<T>(operation, options?): Promise<T>;
```

Defined in: [src/retry-utils.ts:92](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/retry-utils.ts#L92)

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
