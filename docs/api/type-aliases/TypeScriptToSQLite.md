[stratadb](../index.md) / TypeScriptToSQLite

# Type Alias: TypeScriptToSQLite&lt;T&gt;

```ts
type TypeScriptToSQLite<T> = T extends string ? "TEXT" | "BLOB" : T extends number ? "INTEGER" | "REAL" | "NUMERIC" : T extends boolean ? "BOOLEAN" | "INTEGER" : T extends Date ? "INTEGER" | "TEXT" | "REAL" : T extends Uint8Array | ArrayBuffer ? "BLOB" : T extends unknown[] ? "TEXT" | "BLOB" : T extends object ? "TEXT" | "BLOB" : SQLiteType;
```

Defined in: [src/schema-types.ts:53](https://github.com/g5becks/StrataDb/blob/847caea40144e6ce38b2b65a82ec03db6216b58f/src/schema-types.ts#L53)

Maps TypeScript types to their corresponding SQLite types.

## Type Parameters

### T

`T`

## Remarks

This ensures compile-time type safety between TypeScript document fields
and SQLite column types. Prevents runtime errors from type mismatches.

## Example

```typescript
type User = Document<{
  name: string;        // TypeScript: string
  age: number;         // TypeScript: number
  active: boolean;     // TypeScript: boolean
  data: Uint8Array;    // TypeScript: binary data
}>;

// ✅ Correct - types align
type NameType = TypeScriptToSQLite<User['name']>;     // 'TEXT' | 'BLOB'
type AgeType = TypeScriptToSQLite<User['age']>;      // 'INTEGER' | 'REAL' | 'NUMERIC'
type ActiveType = TypeScriptToSQLite<User['active']>; // 'BOOLEAN' | 'INTEGER'

// ❌ Compiler error - type mismatch
type Invalid = TypeScriptToSQLite<User['name']>;     // Won't accept 'INTEGER'
```
