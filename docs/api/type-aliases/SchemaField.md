[stratadb](../index.md) / SchemaField

# Type Alias: SchemaField&lt;T, K&gt;

```ts
type SchemaField<T, K> = object;
```

Defined in: [src/schema-types.ts:111](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/schema-types.ts#L111)

Schema field definition for document properties.

## Remarks

Defines how a document field is stored and indexed in SQLite.
The `path` is optional - if omitted, it defaults to `$.{fieldName}` for top-level fields.
Only specify `path` explicitly when:
1. Accessing nested properties (e.g., `$.profile.bio`)
2. Using a shorter field name for a nested property (e.g., field name `theme` with path `$.profile.settings.theme`)

## Example

```typescript
// Top-level field - path is optional (defaults to $.name)
.field('name', {
  type: 'TEXT',
  indexed: true
})

// Nested property with explicit path
.field('bio', {
  path: '$.profile.bio',
  type: 'TEXT',
  indexed: true
})

// Unique constraint with default value
.field('email', {
  type: 'TEXT',
  indexed: true,
  unique: true,
  nullable: false
})

// ❌ Compiler error - type mismatch
.field('name', {
  type: 'INTEGER',  // Error: string field cannot use INTEGER
})
```

## Type Parameters

### T

`T`

The document type

### K

`K` *extends* keyof `T`

The field key within the document type

## Properties

### default?

```ts
readonly default?: T[K];
```

Defined in: [src/schema-types.ts:139](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/schema-types.ts#L139)

Default value when field is not provided on insert

***

### indexed?

```ts
readonly indexed?: boolean;
```

Defined in: [src/schema-types.ts:133](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/schema-types.ts#L133)

Whether to create an index on this field for faster queries

***

### name

```ts
readonly name: K;
```

Defined in: [src/schema-types.ts:113](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/schema-types.ts#L113)

The field name as it appears in the TypeScript type

***

### nullable?

```ts
readonly nullable?: boolean;
```

Defined in: [src/schema-types.ts:130](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/schema-types.ts#L130)

Whether the field can be null (default: true for optional fields)

***

### path?

```ts
readonly path?: JsonPath;
```

Defined in: [src/schema-types.ts:120](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/schema-types.ts#L120)

JSON path for extracting the value from the document.
Defaults to `$.{name}` if omitted (top-level field).
Only specify for nested properties or custom mappings.

***

### type

```ts
readonly type: TypeScriptToSQLite<T[K]>;
```

Defined in: [src/schema-types.ts:127](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/schema-types.ts#L127)

SQLite column type for the generated column.
Must be compatible with the TypeScript type of the field.
Compile-time type checking ensures type safety.

***

### unique?

```ts
readonly unique?: boolean;
```

Defined in: [src/schema-types.ts:136](https://github.com/g5becks/StrataDb/blob/e11f00160f1967891c5654fdf8f093c18f8b8230/src/schema-types.ts#L136)

Whether to enforce uniqueness constraint on this field
