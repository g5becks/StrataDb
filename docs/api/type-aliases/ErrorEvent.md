[stratadb](../index.md) / ErrorEvent

# Type Alias: ErrorEvent

```ts
type ErrorEvent = object;
```

Defined in: [src/collection-events.ts:326](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/collection-events.ts#L326)

Event payload for error events.

## Remarks

Emitted when a collection listener throws or rejects. The `operation`
identifies its event, and `context.source` is "listener". Database operation
failures are delivered through their returned promises.

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

Defined in: [src/collection-events.ts:332](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/collection-events.ts#L332)

Additional context about the operation

***

### error

```ts
readonly error: Error;
```

Defined in: [src/collection-events.ts:330](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/collection-events.ts#L330)

The error that occurred

***

### operation

```ts
readonly operation: string;
```

Defined in: [src/collection-events.ts:328](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/collection-events.ts#L328)

The event whose listener failed
