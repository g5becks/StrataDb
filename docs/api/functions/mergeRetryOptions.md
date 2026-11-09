[stratadb](../index.md) / mergeRetryOptions

# Function: mergeRetryOptions()

```ts
function mergeRetryOptions(
   database?, 
   collection?, 
   operation?
): RetryOptions | undefined;
```

Defined in: [src/retry-utils.ts:155](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/retry-utils.ts#L155)

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
