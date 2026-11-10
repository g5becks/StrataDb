[stratadb](../index.md) / RetryContext

# Type Alias: RetryContext

```ts
type RetryContext = object;
```

Defined in: node\_modules/p-retry/index.d.ts:15

## Properties

### attemptNumber

```ts
readonly attemptNumber: number;
```

Defined in: node\_modules/p-retry/index.d.ts:17

***

### error

```ts
readonly error: Error;
```

Defined in: node\_modules/p-retry/index.d.ts:16

***

### retriesConsumed

```ts
readonly retriesConsumed: number;
```

Defined in: node\_modules/p-retry/index.d.ts:19

***

### retriesLeft

```ts
readonly retriesLeft: number;
```

Defined in: node\_modules/p-retry/index.d.ts:18

***

### retryDelay

```ts
readonly retryDelay: number;
```

Defined in: node\_modules/p-retry/index.d.ts:29

The delay in milliseconds before the next retry attempt.

This is calculated based on `minTimeout`, `factor`, `maxTimeout`, and `randomize` options.

Note: The actual delay may be shorter if it would exceed `maxRetryTime`.
This is `0` when no retry will occur based on the checks completed before the current callback runs. `shouldConsumeRetry` is the exception: it is shown the delay that would be used, since deciding whether to consume the retry is what it is being asked.
