[stratadb](../index.md) / FindOneAndDeleteEvent

# Type Alias: FindOneAndDeleteEvent&lt;T&gt;

```ts
type FindOneAndDeleteEvent<T> = object;
```

Defined in: [src/collection-events.ts:227](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-events.ts#L227)

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

Defined in: [src/collection-events.ts:231](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-events.ts#L231)

The deleted document, or null if not found

***

### filter

```ts
readonly filter: string | QueryFilter<T>;
```

Defined in: [src/collection-events.ts:229](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/collection-events.ts#L229)

The filter used to find the document
