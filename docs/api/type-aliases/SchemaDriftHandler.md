[stratadb](../index.md) / SchemaDriftHandler

# Type Alias: SchemaDriftHandler

```ts
type SchemaDriftHandler = ((change) => void) | "error";
```

Defined in: [src/schema-evolution.ts:23](https://github.com/g5becks/StrataDb/blob/fb2fd55294542cd2ce060c745e0811f89c794ed6/src/schema-evolution.ts#L23)

Receive schema drift, or reject opening a collection with any drift.
