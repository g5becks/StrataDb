[stratadb](../index.md) / QueryOptionsWithoutProjection

# Type Alias: QueryOptionsWithoutProjection&lt;T&gt;

```ts
type QueryOptionsWithoutProjection<T> = QueryOptionsBase<T> & object;
```

Defined in: [src/query-options-types.ts:338](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/query-options-types.ts#L338)

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
