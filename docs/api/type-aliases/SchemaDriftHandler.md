[stratadb](../index.md) / SchemaDriftHandler

# Type Alias: SchemaDriftHandler

```ts
type SchemaDriftHandler = ((change) => void) | "error";
```

Defined in: [src/schema-evolution.ts:23](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/schema-evolution.ts#L23)

Receive schema drift, or reject opening a collection with any drift.
