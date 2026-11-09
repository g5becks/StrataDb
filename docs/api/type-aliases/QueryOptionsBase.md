[stratadb](../index.md) / QueryOptionsBase

# Type Alias: QueryOptionsBase&lt;T&gt;

```ts
type QueryOptionsBase<T> = object;
```

Defined in: [src/query-options-types.ts:540](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/query-options-types.ts#L540)

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

Defined in: [src/query-options-types.ts:561](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/query-options-types.ts#L561)

Cursor-based pagination configuration.
Requires `sort` to be set. More efficient than skip/limit for large datasets.

***

### limit?

```ts
readonly limit?: number;
```

Defined in: [src/query-options-types.ts:545](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/query-options-types.ts#L545)

Maximum number of documents to return

***

### retry?

```ts
readonly retry?: RetryOptions | false;
```

Defined in: [src/query-options-types.ts:574](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/query-options-types.ts#L574)

Retry configuration for this operation.
Overrides collection and database-level retry settings.
Pass `false` to disable retries for this operation.

***

### search?

```ts
readonly search?: TextSearchSpec<T>;
```

Defined in: [src/query-options-types.ts:555](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/query-options-types.ts#L555)

Multi-field text search configuration.
Searches across specified fields with OR logic (match any field).
Combined with filter using AND logic.

***

### signal?

```ts
readonly signal?: AbortSignal;
```

Defined in: [src/query-options-types.ts:567](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/query-options-types.ts#L567)

AbortSignal for cancelling the operation.
When the signal is aborted, the operation will throw an AbortedError.

***

### skip?

```ts
readonly skip?: number;
```

Defined in: [src/query-options-types.ts:548](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/query-options-types.ts#L548)

Number of documents to skip (for pagination)

***

### sort?

```ts
readonly sort?: SortSpec<T>;
```

Defined in: [src/query-options-types.ts:542](https://github.com/g5becks/StrataDb/blob/b779de76674dc987e520cac4208deb63cba043bc/src/query-options-types.ts#L542)

Sort order for results (MongoDB-style: 1 = asc, -1 = desc)
