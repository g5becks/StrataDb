[stratadb](../index.md) / DeleteEvent

# Type Alias: DeleteEvent&lt;T&gt;

```ts
type DeleteEvent<T> = object;
```

Defined in: [src/collection-events.ts:169](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-events.ts#L169)

Event payload for single document delete operations.

## Remarks

Emitted after `deleteOne()` attempts to delete a document.
The `deleted` flag indicates whether a document was actually deleted.

## Example

```typescript
collection.on('delete', (event) => {
  if (event.deleted) {
    console.log('Document was deleted')
  }
})
```

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

The document type extending Document

## Properties

### deleted

```ts
readonly deleted: boolean;
```

Defined in: [src/collection-events.ts:173](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-events.ts#L173)

Whether a document was deleted

***

### filter

```ts
readonly filter: string | QueryFilter<T>;
```

Defined in: [src/collection-events.ts:171](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-events.ts#L171)

The filter used to find the document
