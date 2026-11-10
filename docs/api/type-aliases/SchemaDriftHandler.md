[stratadb](../index.md) / SchemaDriftHandler

# Type Alias: SchemaDriftHandler

```ts
type SchemaDriftHandler = ((change) => void) | "error";
```

Defined in: [src/schema-evolution.ts:23](https://github.com/g5becks/StrataDb/blob/510ba8813d6cab229e0da41a7c5724a99e5d3566/src/schema-evolution.ts#L23)

Receive schema drift, or reject opening a collection with any drift.
