[stratadb](../index.md) / DropEvent

# Type Alias: DropEvent

```ts
type DropEvent = object;
```

Defined in: [src/collection-events.ts:303](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L303)

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

Defined in: [src/collection-events.ts:305](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L305)

The collection name that was dropped
