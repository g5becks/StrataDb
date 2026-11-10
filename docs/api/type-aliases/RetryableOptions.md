[stratadb](../index.md) / RetryableOptions

# Type Alias: RetryableOptions

```ts
type RetryableOptions = RetryOptions & object;
```

Defined in: [src/retry-utils.ts:24](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/retry-utils.ts#L24)

Retry options with optional AbortSignal support.

## Type Declaration

### signal?

```ts
signal?: AbortSignal;
```
