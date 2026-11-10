[stratadb](../index.md) / withRetry

# Function: withRetry()

```ts
function withRetry<T>(operation, options?): Promise<T>;
```

Defined in: [src/retry-utils.ts:94](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/retry-utils.ts#L94)

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
  () => users.find({}),
  { retries: 3, signal: abortController.signal }
)
```
