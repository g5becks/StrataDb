[stratadb](../index.md) / QueryOptionsWithoutProjection

# Type Alias: QueryOptionsWithoutProjection&lt;T&gt;

```ts
type QueryOptionsWithoutProjection<T> = QueryOptionsBase<T> & object;
```

Defined in: [src/query-options-types.ts:338](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/query-options-types.ts#L338)

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
