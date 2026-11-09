[stratadb](../index.md) / UpdateEvent

# Type Alias: UpdateEvent&lt;T&gt;

```ts
type UpdateEvent<T> = object;
```

Defined in: [src/collection-events.ts:85](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-events.ts#L85)

Event payload for single document update operations.

## Remarks

Emitted after `updateOne()` successfully updates or upserts a document.
The `document` field contains the updated document, or `null` if no match
was found and upsert was not enabled. The `upserted` flag indicates whether
a new document was created via upsert.

## Example

```typescript
collection.on('update', (event) => {
  if (event.upserted) {
    console.log('Document was upserted')
  } else if (event.document) {
    console.log('Document was updated')
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

Defined in: [src/collection-events.ts:91](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-events.ts#L91)

The document after update, or null if not found (without upsert)

***

### filter

```ts
readonly filter: string | QueryFilter<T>;
```

Defined in: [src/collection-events.ts:87](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-events.ts#L87)

The filter used to find the document (string ID or QueryFilter)

***

### update

```ts
readonly update: Partial<T>;
```

Defined in: [src/collection-events.ts:89](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-events.ts#L89)

The update that was applied

***

### upserted

```ts
readonly upserted: boolean;
```

Defined in: [src/collection-events.ts:93](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-events.ts#L93)

Whether this was an upsert (document was created)
