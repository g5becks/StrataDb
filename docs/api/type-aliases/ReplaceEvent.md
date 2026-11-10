[stratadb](../index.md) / ReplaceEvent

# Type Alias: ReplaceEvent&lt;T&gt;

```ts
type ReplaceEvent<T> = object;
```

Defined in: [src/collection-events.ts:145](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/collection-events.ts#L145)

Event payload for replace operations.

## Remarks

Emitted after `replaceOne()` successfully replaces a document.
Unlike updates, replace operations replace the entire document
(except for `_id`, `createdAt`, and `updatedAt`).

## Example

```typescript
collection.on('replace', (event) => {
  if (event.document) {
    console.log(`Document ${event.document._id} was replaced`)
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

Defined in: [src/collection-events.ts:149](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/collection-events.ts#L149)

The document after replacement, or null if not found

***

### filter

```ts
readonly filter: string | QueryFilter<T>;
```

Defined in: [src/collection-events.ts:147](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/collection-events.ts#L147)

The filter used to find the document
