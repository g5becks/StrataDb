[stratadb](../index.md) / DeleteEvent

# Type Alias: DeleteEvent&lt;T&gt;

```ts
type DeleteEvent<T> = object & (
  | {
  _id: string;
  deleted: true;
  document?: T;
}
  | {
  _id: null;
  deleted: false;
  document?: never;
});
```

Defined in: [src/collection-events.ts:170](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/collection-events.ts#L170)

Event payload for single document delete operations.

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

The document type extending Document

## Type Declaration

### filter

```ts
readonly filter: string | QueryFilter<T>;
```

The filter used to find the document

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
