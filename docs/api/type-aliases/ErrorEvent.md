[stratadb](../index.md) / ErrorEvent

# Type Alias: ErrorEvent

```ts
type ErrorEvent = object;
```

Defined in: [src/collection-events.ts:326](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L326)

Event payload for error events.

## Remarks

Emitted when an operation encounters an error. This allows for
centralized error handling and logging. The `context` field may
contain additional information about the operation that failed.

## Example

```typescript
collection.on('error', (event) => {
  console.error(`Operation ${event.operation} failed:`, event.error)
  if (event.context) {
    console.error('Context:', event.context)
  }
})
```

## Properties

### context?

```ts
readonly context?: unknown;
```

Defined in: [src/collection-events.ts:332](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L332)

Additional context about the operation

***

### error

```ts
readonly error: Error;
```

Defined in: [src/collection-events.ts:330](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L330)

The error that occurred

***

### operation

```ts
readonly operation: string;
```

Defined in: [src/collection-events.ts:328](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L328)

The operation that failed
