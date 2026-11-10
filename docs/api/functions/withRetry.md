[stratadb](../index.md) / withRetry

# Function: withRetry()

```ts
function withRetry<T>(operation, options?): Promise<T>;
```

Defined in: [src/retry-utils.ts:94](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/retry-utils.ts#L94)

Wraps an async operation with automatic retry logic.

## Type Parameters

### T

`T`

## Parameters

### operation

() => `Promise`&lt;`T`&gt;

The async function to execute with retry

### options?

[`RetryableOptions`](../type-aliases/RetryableOptions.md)

Retry configuration options

## Returns

`Promise`&lt;`T`&gt;

The result of the operation

## Example

```typescript
const result = await withRetry(
  () => users.find({}),
  { retries: 3, signal: abortController.signal }
)
```
