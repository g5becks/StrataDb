[stratadb](../index.md) / DeleteManyEvent

# Type Alias: DeleteManyEvent&lt;T&gt;

```ts
type DeleteManyEvent<T> = object;
```

Defined in: [src/collection-events.ts:192](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L192)

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

Defined in: [src/collection-events.ts:196](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L196)

Number of documents deleted

***

### filter

```ts
readonly filter: QueryFilter<T>;
```

Defined in: [src/collection-events.ts:194](https://github.com/g5becks/StrataDb/blob/bfe87286e3588c98a6bed6b51cdd05a009cd9cf9/src/collection-events.ts#L194)

The filter used to find documents
