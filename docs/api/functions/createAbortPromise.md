[stratadb](../index.md) / createAbortPromise

# Function: createAbortPromise()

```ts
function createAbortPromise(signal?): object;
```

Defined in: [src/abort-utils.ts:58](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/abort-utils.ts#L58)

Creates a promise that rejects when the signal is aborted.

## Parameters

### signal?

`AbortSignal`

Optional AbortSignal to monitor

## Returns

`object`

Object with promise that rejects on abort and cleanup function

### cleanup

```ts
cleanup: () => void;
```

#### Returns

`void`

### promise

```ts
promise: Promise<never>;
```

## Remarks

Use with Promise.race() for operations that don't natively support signals.

**IMPORTANT:** The returned cleanup function MUST be called to prevent memory leaks.
The cleanup function removes the event listener from the signal.

## Example

```typescript
const { promise: abortPromise, cleanup } = createAbortPromise(signal);
try {
  const result = await Promise.race([
    longRunningOperation(),
    abortPromise
  ]);
  return result;
} finally {
  cleanup();
}
```
