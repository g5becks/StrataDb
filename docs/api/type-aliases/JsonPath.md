[stratadb](../index.md) / JsonPath

# Type Alias: JsonPath

```ts
type JsonPath = `$.${string}`;
```

Defined in: [src/path-types.ts:19](https://github.com/g5becks/StrataDb/blob/a0aa3cd074f4d17bb0effadb4531ba4667df1b45/src/path-types.ts#L19)

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
