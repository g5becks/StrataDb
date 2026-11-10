[stratadb](../index.md) / SQLiteType

# Type Alias: SQLiteType

```ts
type SQLiteType = "TEXT" | "INTEGER" | "REAL" | "BOOLEAN" | "NUMERIC" | "BLOB";
```

Defined in: [src/schema-types.ts:20](https://github.com/g5becks/StrataDb/blob/3829d1720c2811f54ed5e11d7a83bd64ad15a7b7/src/schema-types.ts#L20)

SQLite column data types for generated columns.

## Remarks

These types are used when creating generated columns from JSON paths.
SQLite will store the extracted value using the specified type for indexing.

## Example

```typescript
// Correct type mappings
const textField: SQLiteType = 'TEXT';      // For strings
const numberField: SQLiteType = 'INTEGER';  // For whole numbers
const realField: SQLiteType = 'REAL';       // For floating point numbers
const boolField: SQLiteType = 'BOOLEAN';    // For true/false values
const dataField: SQLiteType = 'BLOB';       // For binary data
```
