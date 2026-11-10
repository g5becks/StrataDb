[stratadb](../index.md) / FindOneAndReplaceEvent

# Type Alias: FindOneAndReplaceEvent&lt;T&gt;

```ts
type FindOneAndReplaceEvent<T> = object;
```

Defined in: [src/collection-events.ts:289](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/collection-events.ts#L289)

Event payload for findOneAndReplace operations.

## Remarks

Emitted after `findOneAndReplace()` finds and replaces a document.
The `document` field contains either the document before or after
the replacement, depending on the `returnDocument` option. The `upserted`
flag indicates whether a new document was created via upsert.

## Example

```typescript
collection.on('findOneAndReplace', (event) => {
  if (event.upserted) {
    console.log('Document was upserted')
  } else if (event.document) {
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

Defined in: [src/collection-events.ts:293](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/collection-events.ts#L293)

The document (before or after based on options), or null if not found

***

### filter

```ts
readonly filter: string | QueryFilter<T>;
```

Defined in: [src/collection-events.ts:291](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/collection-events.ts#L291)

The filter used to find the document

***

### upserted

```ts
readonly upserted: boolean;
```

Defined in: [src/collection-events.ts:295](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/collection-events.ts#L295)

Whether this was an upsert (document was created)
