[stratadb](../index.md) / CollectionEventMap

# Type Alias: CollectionEventMap&lt;T&gt;

```ts
type CollectionEventMap<T> = object;
```

Defined in: [src/collection-events.ts:364](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L364)

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

Defined in: [src/collection-events.ts:370](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L370)

***

### deleteMany

```ts
deleteMany: [DeleteManyEvent<T>];
```

Defined in: [src/collection-events.ts:371](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L371)

***

### drop

```ts
drop: [DropEvent];
```

Defined in: [src/collection-events.ts:375](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L375)

***

### error

```ts
error: [ErrorEvent];
```

Defined in: [src/collection-events.ts:376](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L376)

***

### findOneAndDelete

```ts
findOneAndDelete: [FindOneAndDeleteEvent<T>];
```

Defined in: [src/collection-events.ts:372](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L372)

***

### findOneAndReplace

```ts
findOneAndReplace: [FindOneAndReplaceEvent<T>];
```

Defined in: [src/collection-events.ts:374](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L374)

***

### findOneAndUpdate

```ts
findOneAndUpdate: [FindOneAndUpdateEvent<T>];
```

Defined in: [src/collection-events.ts:373](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L373)

***

### insert

```ts
insert: [InsertEvent<T>];
```

Defined in: [src/collection-events.ts:365](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L365)

***

### insertMany

```ts
insertMany: [InsertManyEvent<T>];
```

Defined in: [src/collection-events.ts:366](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L366)

***

### replace

```ts
replace: [ReplaceEvent<T>];
```

Defined in: [src/collection-events.ts:369](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L369)

***

### update

```ts
update: [UpdateEvent<T>];
```

Defined in: [src/collection-events.ts:367](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L367)

***

### updateMany

```ts
updateMany: [UpdateManyEvent<T>];
```

Defined in: [src/collection-events.ts:368](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L368)
