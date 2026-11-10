[stratadb](../index.md) / AtomicUpdate

# Type Alias: AtomicUpdate&lt;T&gt;

```ts
type AtomicUpdate<T> = object & { readonly [Key in keyof T]?: never };
```

Defined in: [src/core-types.ts:103](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/core-types.ts#L103)

Atomic operators over mutable document paths. Operator and merge forms cannot mix.

## Type Parameters

### T

`T` *extends* [`Document`](Document.md)

## Type Declaration

### $inc?

```ts
readonly $inc?: { readonly [Path in UpdatePath<T> as NonNullable<PathValue<T, Path>> extends number ? Path : never]?: number };
```

### $pull?

```ts
readonly $pull?: { readonly [Path in UpdatePath<T> as ArrayValue<PathValue<T, Path>> extends never ? never : Path]?: ArrayValue<PathValue<T, Path>> };
```

### $push?

```ts
readonly $push?: { readonly [Path in UpdatePath<T> as ArrayValue<PathValue<T, Path>> extends never ? never : Path]?: ArrayValue<PathValue<T, Path>> };
```

### $set?

```ts
readonly $set?: { readonly [Path in UpdatePath<T>]?: PathValue<T, Path> };
```

### $unset?

```ts
readonly $unset?: { readonly [Path in UpdatePath<T>]?: true | 1 | "" };
```
