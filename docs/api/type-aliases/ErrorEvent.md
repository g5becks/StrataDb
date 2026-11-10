[stratadb](../index.md) / ErrorEvent

# Type Alias: ErrorEvent

```ts
type ErrorEvent = object;
```

Defined in: [src/collection-events.ts:335](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/collection-events.ts#L335)

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

Defined in: [src/collection-events.ts:341](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/collection-events.ts#L341)

Additional context about the operation

***

### error

```ts
readonly error: Error;
```

Defined in: [src/collection-events.ts:339](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/collection-events.ts#L339)

The error that occurred

***

### operation

```ts
readonly operation: string;
```

Defined in: [src/collection-events.ts:337](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/collection-events.ts#L337)

The event whose listener failed
