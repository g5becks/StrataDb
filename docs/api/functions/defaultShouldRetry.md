[stratadb](../index.md) / defaultShouldRetry

# Function: defaultShouldRetry()

```ts
function defaultShouldRetry(context): boolean;
```

Defined in: [src/retry-utils.ts:43](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/retry-utils.ts#L43)

Default retry logic for database operations.
Determines which errors should trigger a retry attempt.

## Parameters

### context

[`RetryContext`](../type-aliases/RetryContext.md)

Retry context containing error and attempt information

## Returns

`boolean`

true if the operation should be retried, false otherwise

## Example

```typescript
const options: RetryOptions = {
  retries: 3,
  shouldRetry: defaultShouldRetry
}
```
