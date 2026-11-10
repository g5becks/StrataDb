[stratadb](../index.md) / QueryOptionsBase

# Type Alias: QueryOptionsBase&lt;T&gt;

```ts
type QueryOptionsBase<T> = object;
```

Defined in: [src/query-options-types.ts:544](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/query-options-types.ts#L544)

Base query options without projection (returns full document type).

## Type Parameters

### T

`T`

The document type being queried

## Properties

### cursor?

```ts
readonly cursor?: CursorSpec;
```

Defined in: [src/query-options-types.ts:565](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/query-options-types.ts#L565)

Cursor-based pagination configuration.
Requires `sort` to be set. More efficient than skip/limit for large datasets.

***

### limit?

```ts
readonly limit?: number;
```

Defined in: [src/query-options-types.ts:549](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/query-options-types.ts#L549)

Maximum number of documents to return

***

### retry?

```ts
readonly retry?: RetryOptions | false;
```

Defined in: [src/query-options-types.ts:578](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/query-options-types.ts#L578)

Retry configuration for this operation.
Overrides collection and database-level retry settings.
Pass `false` to disable retries for this operation.

***

### search?

```ts
readonly search?: TextSearchSpec<T>;
```

Defined in: [src/query-options-types.ts:559](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/query-options-types.ts#L559)

Multi-field text search configuration.
Searches across specified fields with OR logic (match any field).
Combined with filter using AND logic.

***

### signal?

```ts
readonly signal?: AbortSignal;
```

Defined in: [src/query-options-types.ts:571](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/query-options-types.ts#L571)

AbortSignal for cancelling the operation.
When the signal is aborted, the operation will throw an AbortedError.

***

### skip?

```ts
readonly skip?: number;
```

Defined in: [src/query-options-types.ts:552](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/query-options-types.ts#L552)

Number of documents to skip (for pagination)

***

### sort?

```ts
readonly sort?: SortSpec<T>;
```

Defined in: [src/query-options-types.ts:546](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/query-options-types.ts#L546)

Sort order for results (MongoDB-style: 1 = asc, -1 = desc)
