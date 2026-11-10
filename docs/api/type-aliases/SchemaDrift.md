[stratadb](../index.md) / SchemaDrift

# Type Alias: SchemaDrift

```ts
type SchemaDrift = object;
```

Defined in: [src/schema-evolution.ts:14](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/schema-evolution.ts#L14)

A stored generated column removed from or changed by the requested schema.

## Properties

### collection

```ts
readonly collection: string;
```

Defined in: [src/schema-evolution.ts:15](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/schema-evolution.ts#L15)

***

### column

```ts
readonly column: string;
```

Defined in: [src/schema-evolution.ts:16](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/schema-evolution.ts#L16)

***

### expectedType?

```ts
readonly expectedType?: string;
```

Defined in: [src/schema-evolution.ts:19](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/schema-evolution.ts#L19)

***

### kind

```ts
readonly kind: "removed" | "type-changed";
```

Defined in: [src/schema-evolution.ts:17](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/schema-evolution.ts#L17)

***

### storedType

```ts
readonly storedType: string;
```

Defined in: [src/schema-evolution.ts:18](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/schema-evolution.ts#L18)
