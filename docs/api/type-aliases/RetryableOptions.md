[stratadb](../index.md) / RetryableOptions

# Type Alias: RetryableOptions

```ts
type RetryableOptions = RetryOptions & object;
```

Defined in: [src/retry-utils.ts:24](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/retry-utils.ts#L24)

Retry options with optional AbortSignal support.

## Type Declaration

### signal?

```ts
signal?: AbortSignal;
```
