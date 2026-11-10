[stratadb](../index.md) / throwIfAborted

# Function: throwIfAborted()

```ts
function throwIfAborted(signal?): void;
```

Defined in: [src/abort-utils.ts:22](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/abort-utils.ts#L22)

Throws AbortedError if the signal is already aborted.

## Parameters

### signal?

`AbortSignal`

Optional AbortSignal to check

## Returns

`void`

## Throws

When signal is aborted

## Remarks

Should be called at the start of async operations to fail fast if the
operation has already been cancelled. Does nothing if signal is undefined
or not aborted.

## Example

```typescript
async function findUsers(filter: QueryFilter, signal?: AbortSignal) {
  throwIfAborted(signal);
  // Proceed with operation...
}
```
