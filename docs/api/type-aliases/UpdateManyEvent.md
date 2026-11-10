[stratadb](../index.md) / UpdateManyEvent

# Type Alias: UpdateManyEvent&lt;T&gt;

```ts
type UpdateManyEvent<T> = object;
```

Defined in: [src/collection-events.ts:113](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/collection-events.ts#L113)

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

Defined in: [src/collection-events.ts:117](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/collection-events.ts#L117)

The filter used to find documents

***

### ids

```ts
readonly ids: readonly string[];
```

Defined in: [src/collection-events.ts:115](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/collection-events.ts#L115)

IDs of rows actually updated, in SQLite RETURNING order.

***

### matchedCount

```ts
readonly matchedCount: number;
```

Defined in: [src/collection-events.ts:121](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/collection-events.ts#L121)

Number of documents that matched the filter

***

### modifiedCount

```ts
readonly modifiedCount: number;
```

Defined in: [src/collection-events.ts:123](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/collection-events.ts#L123)

Number of documents that were modified

***

### update

```ts
readonly update: DocumentUpdate<T>;
```

Defined in: [src/collection-events.ts:119](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/collection-events.ts#L119)

The update that was applied
