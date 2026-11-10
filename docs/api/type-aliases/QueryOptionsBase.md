[stratadb](../index.md) / QueryOptionsBase

# Type Alias: QueryOptionsBase&lt;T&gt;

```ts
type QueryOptionsBase<T> = object;
```

Defined in: [src/query-options-types.ts:237](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/query-options-types.ts#L237)

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

Defined in: [src/query-options-types.ts:258](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/query-options-types.ts#L258)

Cursor-based pagination configuration.
Requires `sort` to be set. More efficient than skip/limit for large datasets.

***

### limit?

```ts
readonly limit?: number;
```

Defined in: [src/query-options-types.ts:242](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/query-options-types.ts#L242)

Maximum number of documents to return

***

### retry?

```ts
readonly retry?: RetryOptions | false;
```

Defined in: [src/query-options-types.ts:271](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/query-options-types.ts#L271)

Retry configuration for this operation.
Overrides collection and database-level retry settings.
Pass `false` to disable retries for this operation.

***

### search?

```ts
readonly search?: TextSearchSpec<T>;
```

Defined in: [src/query-options-types.ts:252](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/query-options-types.ts#L252)

Multi-field text search configuration.
Searches across specified fields with OR logic (match any field).
Combined with filter using AND logic.

***

### signal?

```ts
readonly signal?: AbortSignal;
```

Defined in: [src/query-options-types.ts:264](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/query-options-types.ts#L264)

AbortSignal for cancelling the operation.
When the signal is aborted, the operation will throw an AbortedError.

***

### skip?

```ts
readonly skip?: number;
```

Defined in: [src/query-options-types.ts:245](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/query-options-types.ts#L245)

Number of documents to skip (for pagination)

***

### sort?

```ts
readonly sort?: SortSpec<T>;
```

Defined in: [src/query-options-types.ts:239](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/query-options-types.ts#L239)

Sort order for results (MongoDB-style: 1 = asc, -1 = desc)
