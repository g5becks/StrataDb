[stratadb](../index.md) / InsertEvent

# Type Alias: InsertEvent&lt;T&gt;

```ts
type InsertEvent<T> = object;
```

Defined in: [src/collection-events.ts:35](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-events.ts#L35)

Event payload for single document insert operations.

## Remarks

Emitted after `insertOne()` successfully creates a document.
The payload includes the complete document with its generated `_id`.

## Example

```typescript
collection.on('insert', (event) => {
  console.log(`Document inserted: ${event.document._id}`)
})
```

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

The document type extending Document

## Properties

### document

```ts
readonly document: T;
```

Defined in: [src/collection-events.ts:37](https://github.com/g5becks/StrataDb/blob/324b1e89d26e7464969bf83f47d2ad5aec8926a8/src/collection-events.ts#L37)

The inserted document with generated _id
