[stratadb](../index.md) / FindOneAndUpdateEvent

# Type Alias: FindOneAndUpdateEvent&lt;T&gt;

```ts
type FindOneAndUpdateEvent<T> = object;
```

Defined in: [src/collection-events.ts:256](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/collection-events.ts#L256)

Event payload for findOneAndUpdate operations.

## Remarks

Emitted after `findOneAndUpdate()` finds and updates a document.
The `document` field contains either the document before or after
the update, depending on the `returnDocument` option. The `upserted`
flag indicates whether a new document was created via upsert.

## Example

```typescript
collection.on('findOneAndUpdate', (event) => {
  if (event.upserted) {
    console.log('Document was upserted')
  } else if (event.document) {
    console.log(`Document ${event.document._id} was updated`)
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

Defined in: [src/collection-events.ts:262](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/collection-events.ts#L262)

The document (before or after based on options), or null if not found

***

### filter

```ts
readonly filter: string | QueryFilter<T>;
```

Defined in: [src/collection-events.ts:258](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/collection-events.ts#L258)

The filter used to find the document

***

### update

```ts
readonly update: DocumentUpdate<T>;
```

Defined in: [src/collection-events.ts:260](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/collection-events.ts#L260)

The update that was applied

***

### upserted

```ts
readonly upserted: boolean;
```

Defined in: [src/collection-events.ts:264](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/collection-events.ts#L264)

Whether this was an upsert (document was created)
