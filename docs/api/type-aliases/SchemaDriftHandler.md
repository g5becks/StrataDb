[stratadb](../index.md) / SchemaDriftHandler

# Type Alias: SchemaDriftHandler

```ts
type SchemaDriftHandler = ((change) => void) | "error";
```

Defined in: [src/schema-evolution.ts:23](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/schema-evolution.ts#L23)

Receive schema drift, or reject opening a collection with any drift.
