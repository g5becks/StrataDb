[stratadb](../index.md) / CollectionEventMap

# Type Alias: CollectionEventMap&lt;T&gt;

```ts
type CollectionEventMap<T> = object;
```

Defined in: [src/collection-events.ts:373](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-events.ts#L373)

Map of event names to their payload types for a collection.

## Remarks

This type defines all available events for a collection and their
corresponding payload types. Each event is mapped to a tuple containing
the event payload type, following the EventEmitter pattern.

The event map enables type-safe event emission and listening:
- TypeScript can validate event names
- Event handler parameters are automatically typed
- Autocomplete works for both event names and payload properties

## Example

```typescript
// Type-safe event listening
collection.on('insert', (event) => {
  // event is automatically typed as InsertEvent<T>
  console.log(event.document._id)
})

collection.on('updateMany', (event) => {
  // event is automatically typed as UpdateManyEvent<T>
  console.log(`Modified ${event.modifiedCount} documents`)
})
```

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

The document type extending Document

## Properties

### delete

```ts
delete: [DeleteEvent<T>];
```

Defined in: [src/collection-events.ts:379](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-events.ts#L379)

***

### deleteMany

```ts
deleteMany: [DeleteManyEvent<T>];
```

Defined in: [src/collection-events.ts:380](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-events.ts#L380)

***

### drop

```ts
drop: [DropEvent];
```

Defined in: [src/collection-events.ts:384](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-events.ts#L384)

***

### error

```ts
error: [ErrorEvent];
```

Defined in: [src/collection-events.ts:385](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-events.ts#L385)

***

### findOneAndDelete

```ts
findOneAndDelete: [FindOneAndDeleteEvent<T>];
```

Defined in: [src/collection-events.ts:381](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-events.ts#L381)

***

### findOneAndReplace

```ts
findOneAndReplace: [FindOneAndReplaceEvent<T>];
```

Defined in: [src/collection-events.ts:383](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-events.ts#L383)

***

### findOneAndUpdate

```ts
findOneAndUpdate: [FindOneAndUpdateEvent<T>];
```

Defined in: [src/collection-events.ts:382](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-events.ts#L382)

***

### insert

```ts
insert: [InsertEvent<T>];
```

Defined in: [src/collection-events.ts:374](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-events.ts#L374)

***

### insertMany

```ts
insertMany: [InsertManyEvent<T>];
```

Defined in: [src/collection-events.ts:375](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-events.ts#L375)

***

### replace

```ts
replace: [ReplaceEvent<T>];
```

Defined in: [src/collection-events.ts:378](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-events.ts#L378)

***

### update

```ts
update: [UpdateEvent<T>];
```

Defined in: [src/collection-events.ts:376](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-events.ts#L376)

***

### updateMany

```ts
updateMany: [UpdateManyEvent<T>];
```

Defined in: [src/collection-events.ts:377](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-events.ts#L377)
