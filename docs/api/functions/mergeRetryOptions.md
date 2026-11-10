[stratadb](../index.md) / mergeRetryOptions

# Function: mergeRetryOptions()

```ts
function mergeRetryOptions(
   database?,
   collection?,
   operation?
): RetryOptions | undefined;
```

Defined in: [src/retry-utils.ts:155](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/retry-utils.ts#L155)

Merges retry options from database, collection, and operation levels.
Operation-level options take precedence over collection-level, which take precedence over database-level.

## Parameters

### database?

`false` \| [`RetryOptions`](../type-aliases/RetryOptions.md)

Database-level retry options

### collection?

`false` \| [`RetryOptions`](../type-aliases/RetryOptions.md)

Collection-level retry options

### operation?

`false` \| [`RetryOptions`](../type-aliases/RetryOptions.md)

Operation-level retry options

## Returns

[`RetryOptions`](../type-aliases/RetryOptions.md) \| `undefined`

Merged retry options, or undefined if retry is disabled

## Example

```typescript
const options = mergeRetryOptions(
  { retries: 3 },
  { retries: 5, minTimeout: 2000 },
  { maxTimeout: 10000 }
)
// Result: { retries: 5, minTimeout: 2000, maxTimeout: 10000 }
```
