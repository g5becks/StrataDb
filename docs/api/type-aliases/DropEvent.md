[stratadb](../index.md) / DropEvent

# Type Alias: DropEvent

```ts
type DropEvent = object;
```

Defined in: [src/collection-events.ts:312](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/collection-events.ts#L312)

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

Defined in: [src/collection-events.ts:314](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/collection-events.ts#L314)

The collection name that was dropped
