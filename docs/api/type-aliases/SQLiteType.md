[stratadb](../index.md) / SQLiteType

# Type Alias: SQLiteType

```ts
type SQLiteType = "TEXT" | "INTEGER" | "REAL" | "BOOLEAN" | "NUMERIC" | "BLOB";
```

Defined in: [src/schema-types.ts:20](https://github.com/g5becks/StrataDb/blob/231fa60d02b0b5d47ae5a05e0d85917918d4437d/src/schema-types.ts#L20)

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
