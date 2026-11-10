[stratadb](../index.md) / QueryOptionsWithOmit

# Type Alias: QueryOptionsWithOmit&lt;T, K&gt;

```ts
type QueryOptionsWithOmit<T, K> = QueryOptionsBase<T> & object;
```

Defined in: [src/query-options-types.ts:326](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/query-options-types.ts#L326)

Query options with `omit` for type-safe field exclusion.

## Type Parameters

### T

`T`

The document type being queried

### K

`K` *extends* keyof `T`

The keys to omit (inferred from the omit array)

## Type Declaration

### omit

```ts
readonly omit: readonly K[];
```

Array of fields to exclude from results.

### projection?

```ts
readonly projection?: never;
```

### select?

```ts
readonly select?: never;
```

## Remarks

When using `omit`, the return type excludes the specified fields.
This provides compile-time type safety.

## Example

```typescript
// Returns Omit<User, 'password' | 'ssn'>[]
const users = await collection.find(
  { status: 'active' },
  { omit: ['password', 'ssn'] as const }
);
users[0].name     // ✅ TypeScript knows this exists
users[0].password // ❌ TypeScript error: property doesn't exist
```
