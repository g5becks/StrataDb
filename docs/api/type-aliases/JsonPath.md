[stratadb](../index.md) / JsonPath

# Type Alias: JsonPath

```ts
type JsonPath = `$.${string}`;
```

Defined in: [src/path-types.ts:19](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/path-types.ts#L19)

JSON path for accessing nested document properties in SQLite.

## Remarks

Must start with `$.` and use dot notation for nested properties.
Array indexing is supported using bracket notation: `$[index]` or `$[#-N]` for negative indexing.

## Example

```typescript
'$.name'                    // Top-level field
'$.profile.bio'             // Nested field
'$.tags[0]'                 // Array element by index
'$.tags[#-1]'               // Last array element
'$.profile.settings.theme'  // Deeply nested field
```
