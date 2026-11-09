[stratadb](../index.md) / RetryOptions

# Type Alias: RetryOptions

```ts
type RetryOptions = object;
```

Defined in: [src/retry-types.ts:17](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/retry-types.ts#L17)

Configuration options for automatic retry with exponential backoff.

## Example

```typescript
const options: RetryOptions = {
  retries: 3,
  factor: 2,
  minTimeout: 1000,
  maxTimeout: 30000,
  randomize: true
}
```

## Properties

### factor?

```ts
factor?: number;
```

Defined in: [src/retry-types.ts:28](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/retry-types.ts#L28)

Exponential backoff factor. Each retry delay is multiplied by this value.

#### Default

```ts
2
```

***

### maxRetryTime?

```ts
maxRetryTime?: number;
```

Defined in: [src/retry-types.ts:52](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/retry-types.ts#L52)

Maximum total time in milliseconds for all retry attempts.

#### Default

```ts
Infinity
```

***

### maxTimeout?

```ts
maxTimeout?: number;
```

Defined in: [src/retry-types.ts:40](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/retry-types.ts#L40)

Maximum delay in milliseconds between retries.

#### Default

```ts
30000
```

***

### minTimeout?

```ts
minTimeout?: number;
```

Defined in: [src/retry-types.ts:34](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/retry-types.ts#L34)

Minimum delay in milliseconds before the first retry.

#### Default

```ts
1000
```

***

### onFailedAttempt?

```ts
onFailedAttempt?: (context) => void | Promise<void>;
```

Defined in: [src/retry-types.ts:60](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/retry-types.ts#L60)

Callback invoked when a retry attempt fails.
Receives context with error details and retry state.

#### Parameters

##### context

[`RetryContext`](RetryContext.md)

Retry context containing error and attempt information

#### Returns

`void` \| `Promise`&lt;`void`&gt;

***

### randomize?

```ts
randomize?: boolean;
```

Defined in: [src/retry-types.ts:46](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/retry-types.ts#L46)

Randomize timeout by multiplying with a factor between 1 and 2.

#### Default

```ts
true
```

***

### retries?

```ts
retries?: number;
```

Defined in: [src/retry-types.ts:22](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/retry-types.ts#L22)

Maximum number of retry attempts.

#### Default

```ts
0
```

***

### shouldConsumeRetry?

```ts
shouldConsumeRetry?: (context) => boolean | Promise<boolean>;
```

Defined in: [src/retry-types.ts:82](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/retry-types.ts#L82)

Callback to determine if a failure should consume a retry from the budget.
Return false to not count this failure against the retry limit.

#### Parameters

##### context

[`RetryContext`](RetryContext.md)

Retry context containing error and attempt information

#### Returns

`boolean` \| `Promise`&lt;`boolean`&gt;

Whether this failure should consume a retry

***

### shouldRetry?

```ts
shouldRetry?: (context) => boolean | Promise<boolean>;
```

Defined in: [src/retry-types.ts:71](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/retry-types.ts#L71)

Callback to determine if a retry should occur.
Return true to retry, false to abort with the error.

#### Parameters

##### context

[`RetryContext`](RetryContext.md)

Retry context containing error and attempt information

#### Returns

`boolean` \| `Promise`&lt;`boolean`&gt;

Whether to retry the operation
