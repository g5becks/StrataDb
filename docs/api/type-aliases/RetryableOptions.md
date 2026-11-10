[stratadb](../index.md) / RetryableOptions

# Type Alias: RetryableOptions

```ts
type RetryableOptions = RetryOptions & object;
```

Defined in: [src/retry-utils.ts:24](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/retry-utils.ts#L24)

Retry options with optional AbortSignal support.

## Type Declaration

### signal?

```ts
signal?: AbortSignal;
```
