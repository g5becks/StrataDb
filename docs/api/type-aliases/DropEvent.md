[stratadb](../index.md) / DropEvent

# Type Alias: DropEvent

```ts
type DropEvent = object;
```

Defined in: [src/collection-events.ts:312](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/collection-events.ts#L312)

Event payload for drop operations.

## Remarks

Emitted after `drop()` successfully drops a collection.
This is a collection-level event that includes the collection name.

## Example

```typescript
collection.on('drop', (event) => {
  console.log(`Collection ${event.name} was dropped`)
})
```

## Properties

### name

```ts
readonly name: string;
```

Defined in: [src/collection-events.ts:314](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/collection-events.ts#L314)

The collection name that was dropped
