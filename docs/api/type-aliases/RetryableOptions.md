[stratadb](../index.md) / RetryableOptions

# Type Alias: RetryableOptions

```ts
type RetryableOptions = RetryOptions & object;
```

Defined in: [src/retry-utils.ts:24](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/retry-utils.ts#L24)

Retry options with optional AbortSignal support.

## Type Declaration

### signal?

```ts
signal?: AbortSignal;
```
