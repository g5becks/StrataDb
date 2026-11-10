[stratadb](../index.md) / DeleteManyEvent

# Type Alias: DeleteManyEvent&lt;T&gt;

```ts
type DeleteManyEvent<T> = object;
```

Defined in: [src/collection-events.ts:199](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/collection-events.ts#L199)

Event payload for batch delete operations.

## Remarks

Emitted after `deleteMany()` deletes multiple documents.
The `deletedCount` indicates how many documents were removed.

## Example

```typescript
collection.on('deleteMany', (event) => {
  console.log(`${event.deletedCount} documents deleted`)
})
```

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

The document type extending Document

## Properties

### deletedCount

```ts
readonly deletedCount: number;
```

Defined in: [src/collection-events.ts:205](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/collection-events.ts#L205)

Number of documents deleted

***

### filter

```ts
readonly filter: QueryFilter<T>;
```

Defined in: [src/collection-events.ts:203](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/collection-events.ts#L203)

The filter used to find documents

***

### ids

```ts
readonly ids: readonly string[];
```

Defined in: [src/collection-events.ts:201](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/collection-events.ts#L201)

IDs of deleted rows, in SQLite RETURNING order.
