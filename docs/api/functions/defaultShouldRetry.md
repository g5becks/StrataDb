[stratadb](../index.md) / defaultShouldRetry

# Function: defaultShouldRetry()

```ts
function defaultShouldRetry(context): boolean;
```

Defined in: [src/retry-utils.ts:43](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/retry-utils.ts#L43)

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
