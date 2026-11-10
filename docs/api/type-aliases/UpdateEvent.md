[stratadb](../index.md) / UpdateEvent

# Type Alias: UpdateEvent&lt;T&gt;

```ts
type UpdateEvent<T> = object & (
  | {
  document: T;
  upserted: false;
}
  | {
  document: T;
  upserted: true;
});
```

Defined in: [src/collection-events.ts:85](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/collection-events.ts#L85)

Event payload for single document update operations.

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

The document type extending Document

## Type Declaration

### filter

```ts
readonly filter: string | QueryFilter<T>;
```

The filter used to find the document (string ID or QueryFilter)

### update

```ts
readonly update: DocumentUpdate<T>;
```

The update that was applied

## Remarks

Emitted after `updateOne()` successfully updates or upserts a document.
Emitted only for a successful update or upsert; `document` is non-null.
The `upserted` flag indicates whether
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
