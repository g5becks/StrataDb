[stratadb](../index.md) / InsertManyEvent

# Type Alias: InsertManyEvent&lt;T&gt;

```ts
type InsertManyEvent<T> = object;
```

Defined in: [src/collection-events.ts:56](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/collection-events.ts#L56)

Event payload for batch insert operations.

## Remarks

Emitted after `insertMany()` completes. This includes all successfully
inserted documents, even if some documents failed (in unordered mode).

## Example

```typescript
collection.on('insertMany', (event) => {
  console.log(`${event.insertedCount} documents inserted`)
})
```

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

The document type extending Document

## Properties

### documents

```ts
readonly documents: readonly T[];
```

Defined in: [src/collection-events.ts:58](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/collection-events.ts#L58)

Array of inserted documents

***

### insertedCount

```ts
readonly insertedCount: number;
```

Defined in: [src/collection-events.ts:60](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/collection-events.ts#L60)

Number of documents successfully inserted
