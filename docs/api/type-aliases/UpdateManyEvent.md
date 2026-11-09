[stratadb](../index.md) / UpdateManyEvent

# Type Alias: UpdateManyEvent&lt;T&gt;

```ts
type UpdateManyEvent<T> = object;
```

Defined in: [src/collection-events.ts:114](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/collection-events.ts#L114)

Event payload for batch update operations.

## Remarks

Emitted after `updateMany()` updates multiple documents.
The `matchedCount` indicates how many documents matched the filter,
while `modifiedCount` indicates how many were actually changed.
These counts may differ if the update didn't change field values.

## Example

```typescript
collection.on('updateMany', (event) => {
  console.log(`Updated ${event.modifiedCount} of ${event.matchedCount} matched documents`)
})
```

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

The document type extending Document

## Properties

### filter

```ts
readonly filter: QueryFilter<T>;
```

Defined in: [src/collection-events.ts:116](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/collection-events.ts#L116)

The filter used to find documents

***

### matchedCount

```ts
readonly matchedCount: number;
```

Defined in: [src/collection-events.ts:120](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/collection-events.ts#L120)

Number of documents that matched the filter

***

### modifiedCount

```ts
readonly modifiedCount: number;
```

Defined in: [src/collection-events.ts:122](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/collection-events.ts#L122)

Number of documents that were modified

***

### update

```ts
readonly update: Partial<T>;
```

Defined in: [src/collection-events.ts:118](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/collection-events.ts#L118)

The update that was applied
