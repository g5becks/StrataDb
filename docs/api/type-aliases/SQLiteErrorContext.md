[stratadb](../index.md) / SQLiteErrorContext

# Type Alias: SQLiteErrorContext

```ts
type SQLiteErrorContext = object;
```

Defined in: [src/errors.ts:2](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/errors.ts#L2)

SQL text, collection and operation associated with a mapped SQLite error.

## Properties

### collection?

```ts
readonly collection?: string;
```

Defined in: [src/errors.ts:4](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/errors.ts#L4)

***

### operation?

```ts
readonly operation?: string;
```

Defined in: [src/errors.ts:5](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/errors.ts#L5)

***

### sql?

```ts
readonly sql?: string;
```

Defined in: [src/errors.ts:3](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/errors.ts#L3)
