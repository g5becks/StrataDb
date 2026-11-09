[stratadb](../index.md) / QueryOptionsWithoutProjection

# Type Alias: QueryOptionsWithoutProjection&lt;T&gt;

```ts
type QueryOptionsWithoutProjection<T> = QueryOptionsBase<T> & object;
```

Defined in: [src/query-options-types.ts:641](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/query-options-types.ts#L641)

Query options without any projection (returns full document type).

## Type Parameters

### T

`T`

The document type being queried

## Type Declaration

### omit?

```ts
readonly omit?: never;
```

### projection?

```ts
readonly projection?: never;
```

### select?

```ts
readonly select?: never;
```
