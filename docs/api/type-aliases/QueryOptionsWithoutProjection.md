[stratadb](../index.md) / QueryOptionsWithoutProjection

# Type Alias: QueryOptionsWithoutProjection&lt;T&gt;

```ts
type QueryOptionsWithoutProjection<T> = QueryOptionsBase<T> & object;
```

Defined in: [src/query-options-types.ts:338](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/query-options-types.ts#L338)

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
