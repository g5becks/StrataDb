[stratadb](../index.md) / ReplaceEvent

# Type Alias: ReplaceEvent&lt;T&gt;

```ts
type ReplaceEvent<T> = object;
```

Defined in: [src/collection-events.ts:144](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/collection-events.ts#L144)

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

Defined in: [src/collection-events.ts:148](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/collection-events.ts#L148)

The document after replacement, or null if not found

***

### filter

```ts
readonly filter: string | QueryFilter<T>;
```

Defined in: [src/collection-events.ts:146](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/collection-events.ts#L146)

The filter used to find the document
