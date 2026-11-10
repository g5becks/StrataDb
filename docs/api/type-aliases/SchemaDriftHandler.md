[stratadb](../index.md) / SchemaDriftHandler

# Type Alias: SchemaDriftHandler

```ts
type SchemaDriftHandler = ((change) => void) | "error";
```

Defined in: [src/schema-evolution.ts:23](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/schema-evolution.ts#L23)

Receive schema drift, or reject opening a collection with any drift.
