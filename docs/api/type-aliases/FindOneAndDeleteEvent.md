[stratadb](../index.md) / FindOneAndDeleteEvent

# Type Alias: FindOneAndDeleteEvent&lt;T&gt;

```ts
type FindOneAndDeleteEvent<T> = object;
```

Defined in: [src/collection-events.ts:218](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L218)

Event payload for findOneAndDelete operations.

## Remarks

Emitted after `findOneAndDelete()` finds and deletes a document.
The `document` field contains the deleted document, or `null` if
no matching document was found.

## Example

```typescript
collection.on('findOneAndDelete', (event) => {
  if (event.document) {
    console.log(`Deleted document: ${event.document._id}`)
  }
})
```

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

The document type extending Document

## Properties

### document

```ts
readonly document: T | null;
```

Defined in: [src/collection-events.ts:222](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L222)

The deleted document, or null if not found

***

### filter

```ts
readonly filter: string | QueryFilter<T>;
```

Defined in: [src/collection-events.ts:220](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L220)

The filter used to find the document
