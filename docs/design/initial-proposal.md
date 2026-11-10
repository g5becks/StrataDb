# Historical initial proposal

This document preserves the original design proposal. Its examples, dependencies,
API sketches and checklists are historical and may differ from the implementation.
Use [the current architecture](../DESIGN.md), the API reference and guides for current behavior.
The former root copy differed in regex sketches and related examples; those differences
are preserved in `root-proposal-differences.patch` (root proposal to docs proposal).

# StrataDB - Design Document

## Executive Summary

This document outlines a comprehensive design for StrataDB, a type-safe document database library built on SQLite. StrataDB achieves full type safety from top to bottom, leveraging TypeScript's advanced type system with `type-fest` utilities. The design focuses on creating a MongoDB-like query interface with compile-time type checking, runtime validation, and a developer-friendly API.

## Goals

1. **Complete Type Safety**: Eliminate all `any` types and ensure compile-time checking throughout
2. **Query Type Safety**: Operators must match field types (e.g., can't compare string to number)
3. **Path Type Safety**: JSON paths must be validated against document structure
4. **Immutable IDs**: Prevent ID modification through type system
5. **Runtime Validation**: Schema validation matching TypeScript types
6. **MongoDB-like Queries**: Familiar query syntax with full type safety
7. **Better Error Handling**: Custom error types for different failure modes
8. **Batch Operations**: Type-safe bulk insert/update/delete
9. **Clean API**: Remove internal exposure, fix async/sync inconsistencies

## Technology Stack

- **Runtime**: Bun (using `bun:sqlite`)
- **Type Utilities**: `type-fest` for advanced type operations
- **Validation**: [Standard Schema](https://standardschema.dev) - use any validator (Zod, Valibot, ArkType, etc.)
- **Query Syntax**: MongoDB-inspired with compile-time validation
- **Query Engine**: Custom implementation using SQLite's native JSONB functions and generated columns
- **No Runtime Dependencies**: Only `type-fest` for types

## Dependencies

### Runtime Dependencies

```json
{
  "dependencies": {
    "@standard-schema/spec": "^1.0.0",
    "fast-safe-stringify": "^2.1.1"
  },
  "devDependencies": {
    "type-fest": "^4.0.0",
    "@types/bun": "latest",
    "typescript": "^5.0.0",
    "zod": "^3.23.0",
    "arktype": "^2.0.0-rc.0"
  }
};
```

### Why These Dependencies?

1. **@standard-schema/spec** (runtime dependency):
   - Provides the Standard Schema interface types
   - Enables use of ANY Standard Schema-compatible validation library
   - Types-only package with no runtime code
   - Zero breaking changes without major version bump
   - Allows users to use Zod, Valibot, ArkType, Effect Schema, TypeBox, Yup, etc.

2. **fast-safe-stringify** (runtime dependency):
   - Safely handles circular references when serializing to JSON
   - Falls back gracefully instead of throwing errors
   - Significantly faster than alternatives (4-6x faster than json-stringify-safe)
   - Essential for storing complex JavaScript objects in SQLite JSONB
   - Provides deterministic serialization with `.stableStringify()`

3. **type-fest** (dev dependency):
   - Provides essential TypeScript utility types for development
   - `Paths<T>` - Generate all property paths (for nested queries)
   - `Get<T, Path>` - Extract type at a path
   - `Except<T, K>` - Omit keys from type
   - `Simplify<T>` - Flatten complex types for better IDE hints
   - `PartialDeep<T>` - Deep partial for updates
   - Only used for type definitions, not shipped to users

4. **zod** (dev dependency):
   - Popular TypeScript-first schema validation library
   - Used in tests to verify Standard Schema integration
   - Ensures StrataDB works correctly with Zod schemas

5. **arktype** (dev dependency):
   - TypeScript's 1:1 validator with excellent performance
   - Used in tests to verify Standard Schema integration
   - Validates StrataDB compatibility with different validator styles

### What We Don't Depend On

The library avoids unnecessary dependencies:
- No MongoDB query parsers (we implement our own using SQLite JSON functions)
- No validation libraries (user brings their own via Standard Schema)
- No ORMs or query builders
- No date/time libraries (use native JavaScript Date)
- Uses Bun's built-in SQLite bindings (`bun:sqlite`)

## Core Type System

### Document Base Types

```typescript
import type {
  Simplify,
  Except,
  ReadonlyDeep,
  PartialDeep,
  Paths,
  Get,
  SetOptional,
  RequireAtLeastOne
} from 'type-fest';

/**
 * Document type with immutable ID.
 *
 * @typeParam T - The document shape (your custom fields)
 *
 * @remarks
 * Generic type that combines your custom document fields with an immutable ID.
 * The ID is automatically managed by StrataDB and cannot be updated after creation.
 * If not provided during insert, a unique ID will be auto-generated.
 *
 * This design allows for clean, composable document types:
 * - `type User = Document<{ name: string; email: string; }>`
 * - No need for `extends` or `&` intersections
 * - Fully type-safe with IntelliSense support
 *
 * @example
 * ```typescript
 * // Simple document type
 * type User = Document<{
 *   name: string;
 *   email: string;
 *   age: number;
 * }>;
 *
 * // Nested document structure
 * type Product = Document<{
 *   name: string;
 *   price: number;
 *   inventory: {
 *     stock: number;
 *     warehouse: string;
 *   };
 * }>;
 *
 * // With arrays and optional fields
 * type Post = Document<{
 *   title: string;
 *   content: string;
 *   published: boolean;
 *   tags: string[];
 *   author?: {
 *     name: string;
 *     email: string;
 *   };
 * }>;
 *
 * // All types work seamlessly with collections
 * using db = new StrataDB({ database: './app.db' });
 * const users = db.collection<User>('users', schema);
 * ```
 */
export type Document<T = Record<string, unknown>> = {
  /** Unique identifier for the document (immutable) */
  readonly id: string;
} & T;

/**
 * Document input type for insertion operations.
 *
 * @typeParam T - The full document type (Document<YourShape>)
 *
 * @remarks
 * All fields from the document type are required except for the ID.
 * The ID is optional - if omitted, a unique ID will be auto-generated.
 * This type is used for `insertOne()` and `insertMany()` operations.
 *
 * @example
 * ```typescript
 * type User = Document<{
 *   name: string;
 *   email: string;
 *   age: number;
 * }>;
 *
 * const userInput: DocumentInput<User> = {
 *   name: 'Alice',
 *   email: 'alice@example.com',
 *   age: 30
 *   // id is optional
 * };
 *
 * await users.insertOne(userInput);
 * ```
 */
export type DocumentInput<T extends Document> = Simplify<
  SetOptional<Except<T, 'id'>, never> & { id?: string }
>;

/**
 * Document update type for update operations.
 *
 * @typeParam T - The full document type (Document<YourShape>)
 *
 * @remarks
 * All fields are optional (deep partial) except for the ID which cannot be updated.
 * Used for `updateOne()` and `updateMany()` operations.
 * Supports nested updates using dot notation.
 *
 * @example
 * ```typescript
 * type User = Document<{
 *   name: string;
 *   email: string;
 *   profile: {
 *     bio: string;
 *   };
 * }>;
 *
 * const update: DocumentUpdate<User> = {
 *   name: 'Alice Smith',  // Update name only
 *   profile: {
 *     bio: 'New bio'      // Partial nested update
 *   }
 * };
 *
 * await users.updateOne('user-id', update);
 * ```
 */
export type DocumentUpdate<T extends Document> = Simplify<
  PartialDeep<Except<T, 'id'>>
>;

/**
 * Result type for bulk insert operations.
 *
 * @typeParam T - The document type extending Document
 *
 * @remarks
 * Provides detailed results for `insertMany()` operations, including:
 * - Successfully inserted documents with generated IDs
 * - Errors for documents that failed validation or insertion
 * - Original document inputs for failed operations
 *
 * When `ordered: false`, insertion continues despite errors.
 * When `ordered: true`, insertion stops at the first error.
 *
 * @example
 * ```typescript
 * const result = await users.insertMany([
 *   { name: 'Alice', email: 'alice@example.com' },
 *   { name: 'Bob', email: 'invalid' },  // Validation error
 *   { name: 'Charlie', email: 'charlie@example.com' }
 * ], { ordered: false });
 *
 * console.log(result.insertedCount);  // 2 (Alice and Charlie)
 * console.log(result.errors.length);  // 1 (Bob failed)
 * console.log(result.errors[0].index);  // 1
 * console.log(result.errors[0].error);  // ValidationError
 * ```
 */
export type BulkWriteResult<T> = {
  /** Number of documents successfully inserted */
  readonly insertedCount: number;

  /** Array of generated IDs for successfully inserted documents */
  readonly insertedIds: ReadonlyArray<string>;

  /** Array of successfully inserted documents with IDs */
  readonly documents: ReadonlyArray<T>;

  /** Array of errors for failed insertions */
  readonly errors: ReadonlyArray<{
    /** Index of the failed document in the input array */
    readonly index: number;

    /** Error that caused the insertion to fail */
    readonly error: Error;

    /** Original document input that failed */
    readonly document: DocumentInput<T>;
  }>;
};
```

### Nested Property Path Types

TypeScript's `Paths` utility from type-fest generates all valid paths through an object:

```typescript
/**
 * Extracts all valid property paths from a document type.
 *
 * @typeParam T - The document type
 *
 * @remarks
 * Generates a union type of all possible paths through the document structure,
 * including nested properties. Uses type-fest's `Paths` utility internally.
 *
 * @example
 * ```typescript
 * interface User extends Document {
 *   name: string;
 *   profile: {
 *     bio: string;
 *     settings: {
 *       theme: 'light' | 'dark';
 *     };
 *   };
 * }
 *
 * // DocumentPath<User> produces:
 * // 'name' | 'profile' | 'profile.bio' | 'profile.settings' | 'profile.settings.theme'
 * ```
 */
export type DocumentPath<T> = Paths<T>;

/**
 * Gets the type at a specific document path.
 *
 * @typeParam T - The document type
 * @typeParam P - The path string (must be a valid path in T)
 *
 * @remarks
 * Extracts the TypeScript type of the value at the given path.
 * Uses type-fest's `Get` utility internally.
 * Provides compile-time type safety for nested property access.
 *
 * @example
 * ```typescript
 * interface User extends Document {
 *   name: string;
 *   profile: {
 *     settings: {
 *       theme: 'light' | 'dark';
 *     };
 *   };
 * }
 *
 * type ThemeType = PathValue<User, 'profile.settings.theme'>;  // 'light' | 'dark'
 * type NameType = PathValue<User, 'name'>;  // string
 * ```
 */
export type PathValue<T, P extends DocumentPath<T>> = Get<T, P>;

// Examples:
type User = {
  name: string;
  profile: {
    bio: string;
    settings: {
      theme: 'light' | 'dark';
      notifications: boolean;
    };
  };
  tags: string[];
};

// DocumentPath<User> produces:
// | 'name'
// | 'profile'
// | 'profile.bio'
// | 'profile.settings'
// | 'profile.settings.theme'
// | 'profile.settings.notifications'
// | 'tags'

// PathValue<User, 'profile.settings.theme'> = 'light' | 'dark'
// PathValue<User, 'profile.bio'> = string
```

### Schema Definition Types

```typescript
/**
 * JSON path for accessing nested document properties in SQLite.
 *
 * @remarks
 * Must start with `$.` and use dot notation for nested properties.
 * Array indexing is supported using bracket notation: `$[index]` or `$[#-N]` for negative indexing.
 *
 * @example
 * ```typescript
 * '$.name'                    // Top-level field
 * '$.profile.bio'             // Nested field
 * '$.tags[0]'                 // Array element by index
 * '$.tags[#-1]'               // Last array element
 * '$.profile.settings.theme'  // Deeply nested field
 * ```
 */
export type JsonPath = `$.${string}`;

/**
 * SQLite column data types for generated columns.
 *
 * @remarks
 * These types are used when creating generated columns from JSON paths.
 * SQLite will store the extracted value using the specified type for indexing.
 */
export type SQLiteType =
  | 'TEXT'     // String values
  | 'INTEGER'  // Whole numbers
  | 'REAL'     // Floating point numbers
  | 'BOOLEAN'  // True/false values (stored as 0/1)
  | 'NUMERIC'  // Numeric values with flexible precision
  | 'BLOB';    // Binary data

/**
 * Maps TypeScript types to their corresponding SQLite types.
 *
 * @remarks
 * This ensures compile-time type safety between TypeScript document fields
 * and SQLite column types. Prevents runtime errors from type mismatches.
 *
 * @example
 * ```typescript
 * type User = Document<{
 *   name: string;    // Must use SQLiteType = 'TEXT'
 *   age: number;     // Must use 'INTEGER' | 'REAL' | 'NUMERIC'
 *   active: boolean; // Must use 'BOOLEAN'
 * }>;
 *
 * // ✅ Correct - types align
 * .field('name', { type: 'TEXT' })
 * .field('age', { type: 'INTEGER' })
 * .field('active', { type: 'BOOLEAN' })
 *
 * // ❌ Compiler error - type mismatch
 * .field('name', { type: 'INTEGER' })  // Error: string field cannot use INTEGER
 * .field('age', { type: 'TEXT' })      // Error: number field cannot use TEXT
 * ```
 */
export type TypeScriptToSQLite<T> =
  T extends string ? 'TEXT' | 'BLOB' :
  T extends number ? 'INTEGER' | 'REAL' | 'NUMERIC' :
  T extends boolean ? 'BOOLEAN' | 'INTEGER' :
  T extends Date ? 'INTEGER' | 'TEXT' | 'REAL' :
  T extends Uint8Array | ArrayBuffer ? 'BLOB' :
  T extends Array<unknown> ? 'TEXT' | 'BLOB' :
  T extends object ? 'TEXT' | 'BLOB' :
  SQLiteType; // Fallback for complex types

/**
 * Schema field definition for document properties.
 *
 * @typeParam T - The document type
 * @typeParam K - The field key within the document type
 *
 * @remarks
 * Defines how a document field is stored and indexed in SQLite.
 * The `path` is optional - if omitted, it defaults to `$.{fieldName}` for top-level fields.
 * Only specify `path` explicitly when:
 * 1. Accessing nested properties (e.g., `$.profile.bio`)
 * 2. Using a shorter field name for a nested property (e.g., field name `theme` with path `$.profile.settings.theme`)
 *
 * @example
 * ```typescript
 * // Top-level field - path is optional (defaults to $.name)
 * .field('name', {
 *   type: 'TEXT',
 *   indexed: true
 * })
 *
 * // Nested property - path required
 * .field('bio', {
 *   path: '$.profile.bio',
 *   type: 'TEXT',
 *   indexed: true
 * })
 *
 * // Unique constraint with default value
 * .field('email', {
 *   type: 'TEXT',
 *   indexed: true,
 *   unique: true,
 *   nullable: false
 * })
 * ```
 */
export type SchemaField<T, K extends keyof T> = {
  /** The field name as it appears in the TypeScript type */
  readonly name: K;

  /**
   * JSON path for extracting the value from the document.
   * Defaults to `$.{name}` if omitted (top-level field).
   * Only specify for nested properties or custom mappings.
   */
  readonly path?: JsonPath;

  /**
   * SQLite column type for the generated column.
   * Must be compatible with the TypeScript type of the field.
   * Compile-time type checking ensures type safety.
   */
  readonly type: TypeScriptToSQLite<T[K]>;

  /** Whether the field can be null (default: true for optional fields) */
  readonly nullable?: boolean;

  /** Whether to create an index on this field for faster queries */
  readonly indexed?: boolean;

  /** Whether to enforce uniqueness constraint on this field */
  readonly unique?: boolean;

  /** Default value when field is not provided on insert */
  readonly default?: T[K];
};

/**
 * Compound index definition for multi-field indexes.
 *
 * @typeParam T - The document type
 *
 * @remarks
 * Compound indexes improve query performance when filtering by multiple fields together.
 * The order of fields matters - queries must use fields from left to right for the index to be effective.
 *
 * @example
 * ```typescript
 * // Define compound index on age and status
 * .compoundIndex('age_status', ['age', 'status'])
 *
 * // Queries that can use this index:
 * { age: 30, status: 'active' }           // Uses index fully
 * { age: { $gte: 25 } }                   // Uses index partially (age only)
 *
 * // Queries that CANNOT use this index:
 * { status: 'active' }                    // Doesn't start with first field (age)
 * ```
 */
export type CompoundIndex<T> = {
  /** Unique name for the index (e.g., 'age_status', 'email_tenant') */
  readonly name: string;

  /** Array of field names to include in the index (order matters) */
  readonly fields: ReadonlyArray<keyof T>;

  /** Whether to enforce uniqueness across the combination of fields */
  readonly unique?: boolean;
};

/**
 * Complete schema definition for a collection.
 *
 * @typeParam T - The document type
 *
 * @remarks
 * Defines the structure, indexes, validation, and behavior for a collection.
 * This is typically created using the `createSchema()` builder function.
 */
export type SchemaDefinition<T> = {
  /** Array of field definitions for indexing and querying */
  readonly fields: ReadonlyArray<SchemaField<T, keyof T>>;

  /** Optional compound indexes for multi-field queries */
  readonly compoundIndexes?: ReadonlyArray<CompoundIndex<T>>;

  /**
   * Enable automatic timestamp management.
   * When true, automatically adds/updates `createdAt` and `updatedAt` fields.
   */
  readonly timestamps?: boolean;

  /**
   * Validation function (type predicate) for runtime type checking.
   * Use Standard Schema validators (Zod, Valibot, ArkType, etc.) via `.validator()` method.
   */
  readonly validate: (doc: unknown) => doc is T;
};
```

## Query Type System

### Query Behavior & Edge Cases

**Type Coercion Rules:**
- **NO type coercion**: Queries must match exact types. `{ age: "30" }` will NOT match numeric `30`.
- This is enforced at the TypeScript level - comparing string to number field is a compiler error.

**Null vs Undefined:**
- `null`: Stored as JSON null value
- `undefined`: Field is omitted from document (does not exist)
- Query behavior:
  - `{ field: null }` matches documents where `field === null`
  - `{ field: { $exists: false } }` matches documents without `field` property
  - `{ field: { $exists: true } }` matches documents with `field` (even if `null`)

**Empty Arrays:**
- `{ tags: [] }` matches documents where `tags` is an empty array `[]`
- Does NOT match documents without `tags` field
- Use `{ $or: [{ tags: [] }, { tags: { $exists: false } }] }` to match both

**String Pattern Matching:**
- `$regex` is NOT supported - use `$like`, `$startsWith`, or `$endsWith` instead
- `$like` uses SQL LIKE syntax with `%` wildcard and `_` single character
- `$startsWith` and `$endsWith` are convenience operators
- Examples:
  ```typescript
  // Prefix matching
  { email: { $startsWith: 'admin@' } }

  // Suffix matching
  { email: { $endsWith: '@example.com' } }

  // Contains (using LIKE wildcards)
  { name: { $like: '%alice%' } }
  ```

**Array Indexing:**
- Use `$[index]` path notation to query specific array elements
- Supports negative indexing: `$[-1]` for last element
- Examples:
  ```typescript
  // Query first tag
  { 'tags[0]': 'admin' }  // Translates to $.tags[0]

  // Query last tag
  { 'tags[-1]': 'developer' }  // Translates to $.tags[#-1]

  // Query nested array element
  { 'matrix[0][1]': 5 }  // Translates to $.matrix[0][1]
  ```

**Deeply Nested Queries:**
- Full support for complex `$and`/`$or` combinations
- SQL generation uses parentheses for correct precedence
- Example:
  ```typescript
  {
    $or: [
      { $and: [{ age: { $gt: 18 } }, { status: 'active' }] },
      { $and: [{ age: { $gt: 65 } }, { status: 'retired' }] }
    ]
  }
  // Generates: ((age > 18 AND status = 'active') OR (age > 65 AND status = 'retired'))
  ```

**Array Queries with Null:**
- `{ tags: { $in: [null, 'admin'] } }` matches documents where `tags` is `null` OR `'admin'`
- Null is treated as a valid value in `$in`/`$nin` operators

### Nested Property Queries

The query system supports type-safe nested property access using dot notation:

```typescript
// Dot notation for nested properties
type NestedPaths<T> = Paths<T>;

// Query filter with nested property support
export type QueryFilter<T> = Simplify<
  | LogicalOperator<T>
  | {
      // Direct property access
      [K in keyof T]?: T[K] | FieldOperator<T[K]>;
    }
  | {
      // Dot notation for nested properties (type-safe)
      [P in NestedPaths<T>]?: PathValue<T, P> | FieldOperator<PathValue<T, P>>;
    }
>;

// Example usage with nested types:
interface User extends Document {
  name: string;
  profile: {
    bio: string;
    settings: {
      theme: 'light' | 'dark';
      notifications: boolean;
    };
  };
  tags: string[];
};

// All of these are type-safe:
const query1: QueryFilter<User> = {
  'profile.bio': 'Software engineer' // ✓ Valid
};

const query2: QueryFilter<User> = {
  'profile.settings.theme': 'dark' // ✓ Valid
};

const query3: QueryFilter<User> = {
  'profile.settings.notifications': true // ✓ Valid
};

const query4: QueryFilter<User> = {
  'profile.settings.theme': { $in: ['light', 'dark'] } // ✓ Valid
};

// TypeScript errors:
const invalid1: QueryFilter<User> = {
  'profile.nonexistent': 'value' // ✗ Error: path doesn't exist
};

const invalid2: QueryFilter<User> = {
  'profile.settings.theme': 'blue' // ✗ Error: invalid value
};
```

### Query Operators

```typescript
// Comparison operators with type constraints
export type ComparisonOperator<T> = 
  | { $eq: T }
  | { $ne: T }
  | { $gt: T extends number | Date ? T : never }
  | { $gte: T extends number | Date ? T : never }
  | { $lt: T extends number | Date ? T : never }
  | { $lte: T extends number | Date ? T : never }
  | { $in: ReadonlyArray<T> }
  | { $nin: ReadonlyArray<T> };

// String-specific operators
export type StringOperator =
  | { $like: string }        // SQL LIKE pattern with % and _ wildcards
  | { $startsWith: string }  // Prefix matching
  | { $endsWith: string };   // Suffix matching

// Array operators
export type ArrayOperator<T> = T extends ReadonlyArray<infer U>
  ? { $all: ReadonlyArray<U> }
  | { $size: number }
  | { $elemMatch: QueryFilter<U> }
  | { $index: number } // Access array element by index (0-based or negative)
  : never;

// Existence operators
export type ExistenceOperator = 
  | { $exists: boolean };

// Combined field operators
export type FieldOperator<T> = 
  | ComparisonOperator<T>
  | (T extends string ? StringOperator : never)
  | (T extends ReadonlyArray<any> ? ArrayOperator<T> : never)
  | ExistenceOperator;

// Logical operators
export type LogicalOperator<T> = 
  | { $and: ReadonlyArray<QueryFilter<T>> }
  | { $or: ReadonlyArray<QueryFilter<T>> }
  | { $nor: ReadonlyArray<QueryFilter<T>> }
  | { $not: QueryFilter<T> };

// Root query filter
export type QueryFilter<T> = Simplify<
  | LogicalOperator<T>
  | {
      [K in keyof T]?: T[K] | FieldOperator<T[K]>;
    }
>;
```

### Query Options Types

```typescript
// Sort specification (MongoDB-style)
export type SortSpec<T> = {
  [K in keyof T]?: 1 | -1; // 1 = ascending, -1 = descending
};

// Projection specification (select which fields to return)
export type ProjectionSpec<T> = {
  [K in keyof T]?: 1 | 0; // 1 = include, 0 = exclude
};

// Query options for find operations
export type QueryOptions<T extends Document> = {
  readonly sort?: SortSpec<T>;
  readonly limit?: number;
  readonly skip?: number; // offset
  readonly projection?: ProjectionSpec<T>;
};
```

## Collection API

### Collection Interface

```typescript
export type Collection<T extends Document> = {
  // Read operations (MongoDB-style)
  findById(id: string): Promise<T | null>;
  find(
    filter: QueryFilter<T>, 
    options?: QueryOptions<T>
  ): Promise<ReadonlyArray<T>>;
  findOne(
    filter: QueryFilter<T>, 
    options?: Omit<QueryOptions<T>, 'limit' | 'skip'>
  ): Promise<T | null>;
  count(filter?: QueryFilter<T>): Promise<number>;
  
  // Write operations (single)
  insertOne(doc: DocumentInput<T>): Promise<T>;
  updateOne(
    id: string,
    update: DocumentUpdate<T>,
    options?: { upsert?: boolean }
  ): Promise<T | null>;
  replaceOne(id: string, doc: Except<T, 'id'>): Promise<T | null>;
  deleteOne(id: string): Promise<boolean>;
  
  // Batch operations
  insertMany(
    docs: ReadonlyArray<DocumentInput<T>>,
    options?: { ordered?: boolean }
  ): Promise<BulkWriteResult<T>>;
  updateMany(
    filter: QueryFilter<T>,
    update: DocumentUpdate<T>
  ): Promise<{ modifiedCount: number }>;
  deleteMany(filter: QueryFilter<T>): Promise<{ deletedCount: number }>;
  
  // Validation using Standard Schema
  validate(doc: unknown): Promise<T>;
  validateSync(doc: unknown): T; // Throws on validation error
  
  // Metadata
  readonly name: string;
  readonly schema: SchemaDefinition<T>;
};
```

## Database API

### Database Interface

```typescript
import type { Database as SQLiteDatabase } from 'bun:sqlite';

// Factory function for creating/configuring database
export type DatabaseFactory = () => SQLiteDatabase;

/**
 * Custom ID generator function type.
 *
 * @returns A unique string ID for a new document
 *
 * @remarks
 * Allows custom ID generation strategies (UUIDs, ULIDs, nanoid, etc.).
 * If not provided, StrataDB uses a default ID generator.
 *
 * @example
 * ```typescript
 * import { nanoid } from 'nanoid';
 *
 * const idGenerator: IdGenerator = () => nanoid();
 * ```
 */
export type IdGenerator = () => string;

/**
 * Configuration options for StrataDB instance.
 *
 * @remarks
 * Configures database connection, lifecycle hooks, debug mode, and ID generation.
 *
 * @example
 * ```typescript
 * import { Database } from 'bun:sqlite';
 * import { nanoid } from 'nanoid';
 *
 * // Simple configuration with file path
 * const db = new StrataDB({
 *   database: './myapp.db',
 *   debug: true
 * });
 *
 * // Advanced configuration with factory function
 * const db = new StrataDB({
 *   database: () => {
 *     const db = new Database('./myapp.db');
 *     db.exec('PRAGMA journal_mode = WAL');
 *     return db;
 *   },
 *   idGenerator: () => nanoid(),
 *   debug: (sql, params) => {
 *     console.log('SQL:', sql);
 *     console.log('Params:', params);
 *   }
 * });
 * ```
 */
export type DatabaseOptions = {
  /**
   * Database connection - either a file path string or factory function.
   * Factory function allows full control over SQLite connection options.
   */
  readonly database?: DatabaseFactory | string;

  /**
   * Custom ID generator function for auto-generating document IDs.
   * If omitted, uses default ID generation strategy.
   */
  readonly idGenerator?: IdGenerator;

  /**
   * Optional lifecycle hook called when database is closed.
   * Useful for cleanup operations, logging, or notifications.
   */
  readonly onClose?: (db: SQLiteDatabase) => Promise<void> | void;

  /**
   * Debug mode for logging generated SQL queries.
   * - `true`: Logs SQL to console
   * - Function: Custom logging handler with SQL and parameters
   * - `false` or omitted: No logging
   */
  readonly debug?: boolean | ((sql: string, params: unknown[]) => void);

  /**
   * @deprecated Use factory function with `db.exec('PRAGMA journal_mode = WAL')` instead
   */
  readonly wal?: boolean;

  /**
   * @deprecated Use factory function with verbose option instead
   */
  readonly verbose?: boolean;
};

export type StrataDB = {
  /**
   * Create or access a collection with schema definition.
   *
   * @typeParam T - The document type for this collection
   * @param name - Collection name
   * @param schema - Optional pre-built schema definition
   * @returns Schema builder (if no schema provided) or Collection instance (if schema provided)
   *
   * @remarks
   * Supports two API styles:
   * 1. **Fluent API**: `db.collection<T>(name).field(...).build()`
   * 2. **Declarative API**: `db.collection<T>(name, createSchema<T>().field(...).build())`
   *
   * @example
   * ```typescript
   * type User = Document<{ name: string; email: string; age: number; }>;
   *
   * // Style 1: Fluent API (inline schema)
   * const users1 = db.collection<User>('users')
   *   .field('name', { type: 'TEXT', indexed: true })
   *   .field('email', { type: 'TEXT', indexed: true, unique: true })
   *   .field('age', { type: 'INTEGER' })
   *   .build();
   *
   * // Style 2: Declarative API (separate schema)
   * const userSchema = createSchema<User>()
   *   .field('name', { type: 'TEXT', indexed: true })
   *   .field('email', { type: 'TEXT', indexed: true, unique: true })
   *   .field('age', { type: 'INTEGER' })
   *   .build();
   * const users2 = db.collection<User>('users', userSchema);
   * ```
   */
  collection<T extends Document>(name: string): SchemaBuilder<T>;
  collection<T extends Document>(name: string, schema: SchemaDefinition<T>): Collection<T>;
  
  // Transaction support
  transaction<R>(
    callback: (tx: Transaction) => Promise<R>
  ): Promise<R>;
  
  // Raw SQL access (escaped) - advanced use only
  execute(sql: string, params?: ReadonlyArray<unknown>): Promise<unknown>;
  
  // Lifecycle
  close(): Promise<void>;
  
  // Using Symbol.dispose for automatic cleanup
  [Symbol.dispose](): void;
  
  /**
   * Access to underlying SQLite database (read-only, advanced use).
   *
   * @remarks
   * This provides direct access to the Bun SQLite database instance for advanced operations
   * that are not covered by the StrataDB API. Use with caution as direct SQL operations
   * bypass StrataDB's type safety and validation.
   *
   * @example
   * ```typescript
   * using db = new StrataDB({ database: './mydb.sqlite' });
   *
   * // Execute raw SQL query
   * const result = db.sqliteDb.query('SELECT COUNT(*) FROM users').get();
   *
   * // Use SQLite pragma
   * db.sqliteDb.exec('PRAGMA journal_mode = WAL');
   * ```
   */
  readonly sqliteDb: SQLiteDatabase;
};

export type Transaction = {
  collection<T extends Document>(
    name: string
  ): Collection<T>;
  
  commit(): Promise<void>;
  rollback(): Promise<void>;
  
  // Using Symbol.dispose for automatic rollback on error
  [Symbol.dispose](): void;
};
```

## Schema Builder API

### Type-Safe Schema Construction

```typescript
/**
 * Fluent builder interface for defining collection schemas.
 *
 * @typeParam T - The document type extending Document
 *
 * @remarks
 * Provides a chainable API for defining fields, indexes, timestamps, and validation.
 * Use the `createSchema<T>()` helper function to create a schema builder.
 *
 * @example
 * ```typescript
 * const schema = createSchema<User>()
 *   .field('name', { type: 'TEXT', indexed: true })
 *   .field('email', { type: 'TEXT', indexed: true, unique: true })
 *   .field('age', { type: 'INTEGER', indexed: true })
 *   .compoundIndex('age_status', ['age', 'status'])
 *   .timestamps(true)
 *   .validator(UserSchema)  // Zod, Valibot, ArkType, etc.
 *   .build();
 * ```
 */
export type SchemaBuilder<T extends Document> = {
  /**
   * Define an indexed field with type checking.
   *
   * @param name - The field name from the document type
   * @param options - Field configuration options
   * @returns This builder instance for method chaining
   *
   * @remarks
   * The `path` option is optional and defaults to `$.{name}` for top-level fields.
   * Only specify `path` when accessing nested properties or creating custom field mappings.
   *
   * @example
   * ```typescript
   * // Top-level field (path defaults to $.name)
   * .field('name', { type: 'TEXT', indexed: true })
   *
   * // Nested property with explicit path
   * .field('bio', { path: '$.profile.bio', type: 'TEXT', indexed: true })
   *
   * // Unique email with nullable constraint
   * .field('email', { type: 'TEXT', indexed: true, unique: true, nullable: false })
   * ```
   */
  field<K extends keyof T>(
    name: K,
    options: {
      /** JSON path (defaults to $.{name} if omitted) */
      path?: JsonPath;
      /** SQLite column type (must match TypeScript type) */
      type: TypeScriptToSQLite<T[K]>;
      /** Whether field can be null */
      nullable?: boolean;
      /** Create index for faster queries */
      indexed?: boolean;
      /** Enforce uniqueness constraint */
      unique?: boolean;
      /** Default value when not provided */
      default?: T[K];
    }
  ): this;

  /**
   * Define a compound index spanning multiple fields.
   *
   * @param name - Unique name for the index
   * @param fields - Array of field names (order matters for query optimization)
   * @param options - Index options (unique constraint)
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * // Compound index for common query pattern
   * .compoundIndex('age_status', ['age', 'status'])
   *
   * // Unique compound constraint
   * .compoundIndex('email_tenant', ['email', 'tenantId'], { unique: true })
   * ```
   */
  compoundIndex(
    name: string,
    fields: ReadonlyArray<keyof T>,
    options?: { unique?: boolean }
  ): this;

  /**
   * Enable automatic timestamp management.
   *
   * @param enabled - Whether to auto-manage createdAt/updatedAt (default: true)
   * @returns This builder instance for method chaining
   *
   * @remarks
   * When enabled, automatically adds `createdAt` on insert and updates `updatedAt` on modifications.
   *
   * @example
   * ```typescript
   * .timestamps(true)
   * ```
   */
  timestamps(enabled?: boolean): this;

  /**
   * Add validation function (type predicate).
   *
   * @param validator - Function that validates and narrows the document type
   * @returns This builder instance for method chaining
   *
   * @remarks
   * This is typically used when providing custom validation logic.
   * For Standard Schema validators, use `.validator()` method instead.
   *
   * @example
   * ```typescript
   * .validate((doc): doc is User => {
   *   return typeof doc === 'object' &&
   *          doc !== null &&
   *          'name' in doc &&
   *          typeof doc.name === 'string';
   * })
   * ```
   */
  validate(validator: (doc: unknown) => doc is T): this;

  /**
   * Build and return the complete schema definition.
   *
   * @returns The immutable schema definition
   *
   * @example
   * ```typescript
   * const schema = createSchema<User>()
   *   .field('name', { type: 'TEXT' })
   *   .build();
   * ```
   */
  build(): SchemaDefinition<T>;
};

/**
 * Creates a standalone schema builder for defining collection schemas.
 *
 * @typeParam T - The document type extending Document
 * @returns A new schema builder instance
 *
 * @remarks
 * This function allows you to define schemas separately from collection creation.
 * Useful for reusable schemas or when you prefer a declarative style.
 *
 * @example
 * ```typescript
 * type User = Document<{ name: string; email: string; age: number; }>;
 *
 * // Define schema separately
 * const userSchema = createSchema<User>()
 *   .field('name', { type: 'TEXT', indexed: true })
 *   .field('email', { type: 'TEXT', indexed: true, unique: true })
 *   .field('age', { type: 'INTEGER' })
 *   .timestamps(true)
 *   .build();
 *
 * // Use with collection
 * const users = db.collection<User>('users', userSchema);
 * ```
 */
export function createSchema<T extends Document>(): SchemaBuilder<T>;
```

## Error Types

### Comprehensive Error Hierarchy

```typescript
export abstract class DocDBError extends Error {
  abstract readonly code: string;
  abstract readonly category: 'validation' | 'query' | 'database' | 'transaction';
};

// Validation errors
export class ValidationError extends DocDBError {
  readonly category = 'validation' as const;
  readonly code: string;
  readonly field?: string;
  readonly value?: unknown;
  
  constructor(message: string, field?: string, value?: unknown) {
    super(message);
    this.code = 'VALIDATION_ERROR';
    this.field = field;
    this.value = value;
  }
};

export class SchemaValidationError extends ValidationError {
  readonly code = 'SCHEMA_VALIDATION_ERROR' as const;
};

// Query errors
export class QueryError extends DocDBError {
  readonly category = 'query' as const;
  readonly code: string;
  readonly query?: string;
  
  constructor(message: string, query?: string) {
    super(message);
    this.code = 'QUERY_ERROR';
    this.query = query;
  }
};

export class InvalidQueryOperatorError extends QueryError {
  readonly code = 'INVALID_QUERY_OPERATOR' as const;
};

export class TypeMismatchError extends QueryError {
  readonly code = 'TYPE_MISMATCH' as const;
  readonly field?: string;
  readonly expectedType?: string;
  readonly actualType?: string;

  constructor(
    message: string,
    field?: string,
    expectedType?: string,
    actualType?: string
  ) {
    super(message);
    this.field = field;
    this.expectedType = expectedType;
    this.actualType = actualType;
  }
};

// Database errors
export class DatabaseError extends DocDBError {
  readonly category = 'database' as const;
  readonly code: string;
  readonly sqliteCode?: number;
  
  constructor(message: string, sqliteCode?: number) {
    super(message);
    this.code = 'DATABASE_ERROR';
    this.sqliteCode = sqliteCode;
  }
};

export class ConnectionError extends DatabaseError {
  readonly code = 'CONNECTION_ERROR' as const;
};

export class ConstraintError extends DatabaseError {
  readonly code = 'CONSTRAINT_ERROR' as const;
  readonly constraint?: string;

  constructor(message: string, constraint?: string, sqliteCode?: number) {
    super(message, sqliteCode);
    this.constraint = constraint;
  }
};

export class UniqueConstraintError extends ConstraintError {
  readonly code = 'UNIQUE_CONSTRAINT_ERROR' as const;
  readonly field?: string;
  readonly value?: unknown;

  constructor(
    message: string,
    field?: string,
    value?: unknown,
    sqliteCode?: number
  ) {
    super(message, field, sqliteCode);
    this.field = field;
    this.value = value;
  }
};

// Transaction errors
export class TransactionError extends DocDBError {
  readonly category = 'transaction' as const;
  readonly code: string;
  
  constructor(message: string) {
    super(message);
    this.code = 'TRANSACTION_ERROR';
  }
};

export class TransactionAbortedError extends TransactionError {
  readonly code = 'TRANSACTION_ABORTED' as const;
};
```

## Runtime Validation

### Schema Validation

```typescript
// JSON Schema validator integration
export type JsonSchemaValidator = {
  validate(schema: object, data: unknown): boolean;
  errors?: ReadonlyArray<{
    path: string;
    message: string;
  }>;
};

// Built-in validator using Ajv or similar
export class DefaultValidator implements JsonSchemaValidator {
  // Implementation using Ajv
};

// Schema validation at runtime
export function validateDocument<T>(
  schema: SchemaDefinition<T>,
  doc: unknown
): doc is T {
  // Use validator to check
  // Throw ValidationError if invalid
};
```

## Query Execution Engine

### Query Translation

All queries are translated directly to SQL using SQLite's native capabilities:

- **JSONB format** for storage (binary, faster than text JSON)
- **Generated columns** for indexed fields (created via schema)
- **JSON functions** (`jsonb_extract`, `jsonb_each`, etc.) for queries
- **Parameterized queries** for SQL injection protection
- **No external dependencies** - pure SQLite implementation

```typescript
// Translate MongoDB-like query to SQL
export type QueryTranslator<T extends Document> = {
  translate(filter: QueryFilter<T>): {
    sql: string;
    params: ReadonlyArray<unknown>;
  };
};

// Example implementation using SQLite native functions
class SQLiteQueryTranslator<T extends Document> implements QueryTranslator<T> {
  constructor(
    private schema: SchemaDefinition<T>,
    private tableName: string
  ) {}
  
  translate(filter: QueryFilter<T>): { sql: string; params: unknown[] } {
    // Convert filter to SQL WHERE clause
    // Use generated columns for indexed fields
    // Use jsonb_extract() for non-indexed fields
    // Examples:
    //   { age: { $gt: 18 } } => "_age > ?"
    //   { name: "Alice" } => "_name = ?"
    //   { tags: { $in: [...] } } => "_tags IN (?, ?, ...)"
    //   { $and: [...] } => "(condition1) AND (condition2)"
    //   { $or: [...] } => "(condition1) OR (condition2)"
    //   { tags: { $all: [...] } } => Use jsonb_each() subquery
    //   { tags: { $size: 3 } } => "json_array_length(body, '$.tags') = 3"
    //   { tags: { $elemMatch: {...} } } => Use jsonb_each() with nested conditions
    // Return parameterized SQL
  }
};

// SQLite JSON function examples we'll use (preferring JSONB variants):
// - jsonb_extract(body, '$.path') - Extract value at path (faster than json_extract)
// - jsonb_each(body, '$.array') - Iterate array elements
// - json_type(body, '$.path') - Get type of value
// - json_array_length(body, '$.path') - Array length
// - jsonb() - Convert to JSONB format
// - json() - Convert JSONB to text JSON (for display only)

// Key optimization: Store as JSONB, query with jsonb_* functions
// Only convert to text JSON when returning to user
```

## Migration from Current API

### Breaking Changes

1. **Remove `any` types**: All generic constraints now required
2. **Remove collection caching**: Each collection() call creates new instance
3. **Async consistency**: All operations return Promises (already mostly done)
4. **ID immutability**: Cannot update `id` field
5. **Schema required**: Must provide schema builder function
6. **Error types**: Different error classes instead of generic errors

### Migration Guide

```typescript
// Old API
const users = db.collection<User>('users', schema =>
  schema
    .field('name', '$.name', 'TEXT')
    .field('email', '$.email', 'TEXT')
);

// New API
const users = db.collection<User>('users',
  createSchema<User>()
    .field('name', {
      type: 'TEXT',
      indexed: true
    })
    .field('email', {
      type: 'TEXT',
      indexed: true,
      nullable: false
    })
    .validate((doc): doc is User => {
      return (
        typeof doc === 'object' &&
        doc !== null &&
        'name' in doc &&
        'email' in doc &&
        typeof doc.name === 'string' &&
        typeof doc.email === 'string'
      );
    })
    .build()
);
```

## Better Error Messages

StrataDB provides context-rich error messages to improve developer experience:

### Validation Errors
```typescript
// Before: "Validation failed"
// After:
throw new ValidationError(
  "Validation failed for field 'email': Expected string matching email format, got 'not-an-email'",
  'email',
  'not-an-email'
);
```

### Query Errors
```typescript
// Before: "Query error"
// After:
throw new TypeMismatchError(
  "Invalid operator '$gt' for string field 'name' at path '$.name'. " +
  "Comparison operators ($gt, $gte, $lt, $lte) only work with number and Date fields. " +
  "For string fields, use: $like, $startsWith, or $endsWith.",
  'name',
  'number | Date',
  'string'
);
```

### Constraint Errors
```typescript
// Unique constraint violation
throw new UniqueConstraintError(
  "Duplicate value for unique field 'email': 'alice@example.com' already exists",
  'email',
  'alice@example.com'
);

// Include helpful resolution hints
throw new UniqueConstraintError(
  "Duplicate value for unique field 'email': 'alice@example.com' already exists. " +
  "Consider using updateOne() with upsert option if you want to update existing documents.",
  'email',
  'alice@example.com'
);
```

### Debug Mode
When `debug: true` is enabled, SQL queries are logged with context:

```typescript
using db = new StrataDB({
  database: './app.db',
  debug: true // or custom logger: (sql, params) => console.log(sql, params)
});

// Logs:
// [StrataDB] Query: SELECT id, body FROM users WHERE _email = ?
// [StrataDB] Params: ['alice@example.com']
// [StrataDB] Execution time: 2.3ms
```

## Performance Considerations

### Optimizations

1. **Prepared Statements**: Cache prepared statements per query pattern
2. **Batch Operations**: Use transactions for bulk operations
3. **Generated Columns**: Use VIRTUAL generated columns for indexed fields (zero storage overhead)
4. **Compound Indexes**: Multi-field indexes for common query patterns
5. **JSONB Storage**: Binary format reduces parse overhead (3-5x faster than text JSON)
6. **Index Covering**: Store frequently accessed fields in indexes to avoid document lookup

### Schema Design for Performance

```typescript
// Good: Compound index for common query
const users = db.collection<User>('users',
  createSchema<User>()
    .field('status', { path: '$.status', type: 'TEXT', indexed: true })
    .field('createdAt', { path: '$.createdAt', type: 'INTEGER', indexed: true })
    .compoundIndex('status_created', ['status', 'createdAt'])
    .build()
);

// Query benefits from compound index
await users.find(
  { status: 'active' },
  { sort: { createdAt: -1 }, limit: 20 }
);
```

### Benchmarking

- Compare against current implementation
- Benchmark query translation overhead (<1ms for complex queries)
- Measure type checking impact (compile-time only, zero runtime cost)
- Test bulk operations performance (>10,000 inserts/sec)
- JSONB vs text JSON performance (expect 3-5x improvement)

## Testing Strategy

### Type Testing

```typescript
// Use `tsd` or similar for type tests
import { expectType, expectError } from 'tsd';

interface User extends Document {
  name: string;
  age: number;
  email: string;
};

const users: Collection<User> = {} as any;

// Should compile
expectType<Promise<User | null>>(
  users.findOne({ age: { $gt: 18 } })
);

// Should error - type mismatch
expectError(
  users.findOne({ age: { $gt: "18" } })
);

// Should error - invalid operator for string
expectError(
  users.findOne({ name: { $gt: "John" } })
);
```

### Runtime Testing

1. **Unit Tests**: Each component independently
2. **Integration Tests**: Full query execution
3. **Edge Cases**: Null handling, empty results, large datasets
4. **Error Scenarios**: Validation failures, constraint violations
5. **Concurrent Operations**: Transaction isolation

## Implementation Phases

### Phase 1: Core Type System (Week 1)
- [ ] Define base types using type-fest
- [ ] Implement document types (Document, DocumentInput, DocumentUpdate)
- [ ] Create query filter types
- [ ] Set up error hierarchy

### Phase 2: Schema System (Week 1-2)
- [ ] Implement SchemaBuilder
- [ ] Add runtime validation
- [ ] Create schema-to-SQL translation
- [ ] Add index management

### Phase 3: Query System (Week 2-3)
- [ ] Implement QueryOptions types (sort, limit, skip, projection)
- [ ] Create query translator (filter to SQL WHERE clause)
- [ ] Add comparison operators ($eq, $ne, $gt, $gte, $lt, $lte, $in, $nin)
- [x] Add string operators ($like, $startsWith, $endsWith)
- [ ] Add array operators ($all, $size, $elemMatch)
- [ ] Add logical operators ($and, $or, $nor, $not)
- [ ] Add existence operator ($exists)
- [ ] Implement sort, limit, skip in SQL translation
- [ ] Implement projection (field selection)

### Phase 4: Collection Implementation (Week 3-4)
- [ ] Implement Collection interface
- [ ] Add CRUD operations
- [ ] Implement batch operations
- [ ] Add query execution

### Phase 5: StrataDB & Transactions (Week 4)
- [ ] Implement Database interface
- [ ] Add transaction support
- [ ] Implement using/dispose pattern
- [ ] Add connection management

### Phase 6: Testing & Documentation (Week 5)
- [ ] Write comprehensive tests
- [ ] Add type tests
- [ ] Create migration guide
- [ ] Write API documentation
- [ ] Create examples

### Phase 7: Optimization & Polish (Week 6)
- [ ] Performance benchmarking
- [ ] Query optimization
- [ ] Error message improvements
- [ ] Final API review

## Examples

### Basic Usage

```typescript
import { StrataDB, createSchema, type Document } from './index';
import { Database as SQLiteDatabase } from 'bun:sqlite';

// Define your document type using the generic Document<T>
type User = Document<{
  name: string;
  email: string;
  age: number;
  tags: string[];
  createdAt: Date;
  profile: {
    bio: string;
    avatar?: string;
  };
}>;

// Example 1: Schema with unique constraints, defaults, compound indexes, and timestamps
{
  using db = new StrataDB({ database: './mydb.sqlite', debug: true });

  const users = db.collection<User>(
    'users',
    createSchema<User>()
      // Unique email constraint
      .field('email', {
        type: 'TEXT',
        indexed: true,
        unique: true
      })
      .field('name', { type: 'TEXT', indexed: true })
      .field('age', { type: 'INTEGER', indexed: true })
      .field('tags', { type: 'TEXT' })
      // Compound index for common queries
      .compoundIndex('age_tags', ['age', 'tags'])
      // Auto-manage createdAt/updatedAt
      .timestamps(true)
      .validate((doc): doc is User => {
        return (
          typeof doc === 'object' &&
          doc !== null &&
          'name' in doc &&
          'email' in doc &&
          typeof doc.name === 'string' &&
          typeof doc.email === 'string'
        );
      })
      .build()
  );

  // Insert with auto-generated timestamps
  await users.insertOne({
    name: 'Alice',
    email: 'alice@example.com',
    age: 30,
    tags: ['developer', 'typescript'],
    profile: { bio: 'Software engineer' }
  });
  // Result includes: { ..., createdAt: Date, updatedAt: Date }

  // Unique constraint prevents duplicates
  try {
    await users.insertOne({
      name: 'Bob',
      email: 'alice@example.com', // Duplicate!
      age: 25
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      console.log(error.field); // 'email'
      console.log(error.value); // 'alice@example.com'
      // Consider upsert instead
    }
  }

  // Upsert operation
  await users.updateOne(
    'user-id',
    { age: 31 },
    { upsert: true } // Creates if doesn't exist
  );

  const adults = await users.find({ age: { $gte: 18 } });

} // Database automatically closed here via Symbol.dispose

// Example 2: Factory function for full SQLite control
{
  using db = new StrataDB({
    database: () => {
      const sqlite = new SQLiteDatabase('./mydb.sqlite');
      
      // Full control over SQLite configuration
      sqlite.exec('PRAGMA journal_mode = WAL;');
      sqlite.exec('PRAGMA synchronous = NORMAL;');
      sqlite.exec('PRAGMA cache_size = -64000;'); // 64MB cache
      sqlite.exec('PRAGMA foreign_keys = ON;');
      sqlite.exec('PRAGMA temp_store = MEMORY;');
      sqlite.exec('PRAGMA mmap_size = 30000000000;'); // 30GB mmap
      
      return sqlite;
    },
    onClose: async (sqlite) => {
      // Custom cleanup logic
      console.log('Optimizing database before close...');
      sqlite.exec('PRAGMA analysis_limit = 1000;');
      sqlite.exec('PRAGMA optimize;');
      
      // Checkpoint WAL and truncate
      const result = sqlite.query('PRAGMA wal_checkpoint(TRUNCATE);').get();
      console.log('WAL checkpoint:', result);
    }
  });
  
  const users = db.collection<User>('users', schema);
  
  // Queries with options
  const developers = await users.find(
    {
      tags: { $in: ['developer'] },
      age: { $gt: 25 }
    },
    {
      sort: { name: 1 },
      limit: 10,
      projection: { name: 1, email: 1 } // Only return name and email
    }
  );

  // Batch operations
  await users.insertMany([
    { name: 'Bob', email: 'bob@example.com', age: 25, tags: [], createdAt: new Date(), profile: { bio: '' } },
    { name: 'Charlie', email: 'charlie@example.com', age: 35, tags: [], createdAt: new Date(), profile: { bio: '' } }
  ]);

  // Transactions with automatic rollback on error
  try {
    await db.transaction(async (tx) => {
      const txUsers = tx.collection<User>('users');
      
      const user = await txUsers.findOne({ email: 'alice@example.com' });
      if (user) {
        await txUsers.updateOne(user.id, { age: user.age + 1 });
      }
      
      // Explicit commit (optional - auto-commits if no error)
      await tx.commit();
    });
  } catch (error) {
    // Transaction automatically rolled back
    console.error('Transaction failed:', error);
  }
  
} // onClose called here, then database closed via Symbol.dispose

// Example 3: Accepting pre-configured database instance
{
  // User sets up their own database
  const sqlite = new SQLiteDatabase(':memory:');
  sqlite.exec('PRAGMA journal_mode = WAL;');
  
  // Pass it to our library
  using db = new StrataDB({
    database: () => sqlite,
    onClose: async (db) => {
      console.log('Closing database...');
      // Don't close the connection - user manages it
      // Just do cleanup like optimize
      db.exec('PRAGMA optimize;');
    }
  });
  
  const users = db.collection<User>('users', schema);
  
  await users.insertOne({
    name: 'Test User',
    email: 'test@example.com',
    age: 25,
    tags: [],
    createdAt: new Date(),
    profile: { bio: '' }
  });
  
} // onClose called, but sqlite connection remains open
```

### Advanced Queries

```typescript
// Complex query with multiple conditions
const results = await users.find({
  $and: [
    { age: { $gte: 18, $lte: 65 } },
    { 
      $or: [
        { name: { $startsWith: 'A' } },
        { tags: { $in: ['admin', 'moderator'] } }
      ]
    },
    { email: { $exists: true } }
  ]
}, {
  sort: { age: -1, name: 1 }, // Sort by age desc, then name asc
  limit: 50
});

// Array queries
const usersWithTags = await users.find({
  tags: { $all: ['typescript', 'react'] }
});

const usersWithManyTags = await users.find({
  tags: { $size: 3 } // Exactly 3 tags
});

// Pagination pattern
const page = 2;
const pageSize = 20;
const paginatedUsers = await users.find(
  { isActive: true },
  {
    sort: { createdAt: -1 },
    skip: (page - 1) * pageSize,
    limit: pageSize
  }
);

// Count matching documents
const activeUserCount = await users.count({ isActive: true });
```

## Future Enhancements

1. **Index Hints**: Allow specifying which index to use
2. **Aggregation Pipeline**: MongoDB-style aggregation
3. **Full-Text Search**: SQLite FTS integration
4. **Relationships**: Support for document references
5. **Migrations**: Schema migration utilities
6. **Backup/Restore**: Built-in backup functionality
7. **Replication**: Optional replication support
8. **GraphQL Integration**: Auto-generate GraphQL schema

## Conclusion

This redesign provides a fully type-safe, MongoDB-like document database built on SQLite. By leveraging TypeScript's type system and type-fest utilities, we achieve compile-time safety while maintaining runtime validation. The result is a developer-friendly API that catches errors early and provides excellent IDE support.

## Dependencies

### Production Dependencies
- **type-fest**: Advanced TypeScript type utilities (type-only, no runtime cost)

### Development Dependencies
- **bun-types**: TypeScript definitions for Bun runtime

That's it! No runtime dependencies beyond Bun's built-in SQLite support.

## References

- [type-fest documentation](https://github.com/sindresorhus/type-fest)
- [Bun SQLite documentation](https://bun.sh/docs/api/sqlite)
- [SQLite JSON Functions](https://www.sqlite.org/json1.html)
- [MongoDB Query Language](https://www.mongodb.com/docs/manual/tutorial/query-documents/) - For query syntax inspiration
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

## Automatic Resource Management with `using`

The library extensively uses the `using` declaration for automatic resource cleanup, ensuring databases are always properly closed and transactions are rolled back on errors.

### Why `using` Statements?

1. **Guaranteed Cleanup**: Resources are always disposed, even if errors occur
2. **No Resource Leaks**: Impossible to forget to close database connections
3. **Automatic Error Handling**: Transactions auto-rollback on uncaught errors
4. **Composable**: Multiple `using` statements work together seamlessly
5. **Type-Safe**: TypeScript enforces proper resource handling at compile time

### Database Lifecycle with `using`

```typescript
// Automatic cleanup on scope exit
{
  using db = new StrataDB({ 
    database: './app.db',
    onClose: async (sqlite) => {
      // Called before connection closes
      sqlite.exec('PRAGMA optimize;');
      console.log('Database optimized');
    }
  });
  
  // Use database...
  const users = db.collection<User>('users', schema);
  await users.insertOne({ name: 'Alice', ... });
  
} // Execution order on scope exit:
  // 1. onClose hook called
  // 2. All prepared statements finalized
  // 3. Database connection closed
  // 4. All cleanup guaranteed even if error thrown
```

### Transaction Safety with `using`

Transactions implement `Symbol.dispose` to automatically rollback on errors:

```typescript
{
  using db = new StrataDB({ database: './app.db' });
  
  try {
    await db.transaction(async (tx) => {
      // Transaction will auto-rollback if this callback throws
      const users = tx.collection<User>('users');
      
      await users.insertOne({ name: 'Alice', ... });
      await users.insertOne({ name: 'Bob', ... });
      
      // Simulate an error
      throw new Error('Oops!');
      
      // Never reached
      await tx.commit();
    });
  } catch (error) {
    // Transaction was automatically rolled back
    console.error('Transaction failed:', error);
  }
};

// Explicit using for transaction scope (optional but clearer)
{
  using db = new StrataDB({ database: './app.db' });
  
  await db.transaction(async (tx) => {
    using _ = tx; // Makes rollback behavior explicit
    
    const users = tx.collection<User>('users');
    await users.insertMany([
      { name: 'Alice', ... },
      { name: 'Bob', ... }
    ]);
    
    // Commits automatically if no error
  }); // Auto-rollback here if error thrown
};
```

### Error Aggregation with Multiple Resources

When multiple resources are disposed and errors occur, they are aggregated into a `SuppressedError`:

```typescript
class FailingStrataDB extends StrataDB {
  [Symbol.dispose](): void {
    throw new Error('Failed to close database!');
  }
};

let finalError: Error | undefined;

try {
  using db1 = new FailingStrataDB({ database: './db1.sqlite' });
  using db2 = new FailingStrataDB({ database: './db2.sqlite' });
  
  throw new Error('Main operation failed');
} catch (error) {
  finalError = error as Error;
};

// finalError structure:
// SuppressedError {
//   error: Error('Failed to close database!'), // db1 disposal error
//   suppressed: SuppressedError {
//     error: Error('Main operation failed'),   // original error
//     suppressed: Error('Failed to close database!') // db2 disposal error
//   }
// }

// Resources are disposed in reverse order: db2, then db1
// All errors are captured and aggregated
```

### Patterns for Resource Management

#### Pattern 1: Simple Database Usage

```typescript
async function queryUsers() {
  using db = new StrataDB({ database: './app.db' });
  
  const users = db.collection<User>('users', schema);
  return await users.find({ age: { $gte: 18 } });
  
} // Database closed automatically after return
```

#### Pattern 2: Multiple Databases

```typescript
async function syncDatabases() {
  using source = new StrataDB({ database: './source.db' });
  using target = new StrataDB({ database: './target.db' });
  
  const sourceUsers = source.collection<User>('users', schema);
  const targetUsers = target.collection<User>('users', schema);
  
  const users = await sourceUsers.find({});
  await targetUsers.insertMany(users);
  
} // Both databases closed in reverse order: target, then source
```

#### Pattern 3: Transaction with Nested Using

```typescript
async function transferData() {
  using db = new StrataDB({ database: './app.db' });
  
  await db.transaction(async (tx) => {
    using _ = tx; // Explicit transaction scope
    
    const from = tx.collection<Account>('accounts');
    const to = tx.collection<Account>('accounts');
    
    const account1 = await from.findOne({ id: 'acc1' });
    const account2 = await to.findOne({ id: 'acc2' });
    
    if (!account1 || !account2) {
      throw new Error('Account not found');
    }
    
    await from.updateOne(account1.id, { 
      balance: account1.balance - 100 
    });
    await to.updateOne(account2.id, { 
      balance: account2.balance + 100 
    });
    
    // Auto-commit on success, auto-rollback on error
  });
};
```

#### Pattern 4: Optional Resource Cleanup

```typescript
async function conditionalDatabase(usePersistent: boolean) {
  using db = new StrataDB({
    database: usePersistent ? './persistent.db' : ':memory:',
    onClose: usePersistent 
      ? async (sqlite) => {
          // Only optimize persistent databases
          sqlite.exec('PRAGMA optimize;');
          sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE);');
        }
      : undefined // No cleanup needed for in-memory
  });
  
  // Use database...
  
} // Appropriate cleanup for each database type
```

#### Pattern 5: No Using Statement (Manual Management)

If you need to keep the database open longer than a scope:

```typescript
class UserService {
  private db: StrataDB;
  
  constructor() {
    // Don't use 'using' - we manage lifecycle manually
    this.db = new StrataDB({
      database: './app.db',
      onClose: async (sqlite) => {
        console.log('Service database closing...');
        sqlite.exec('PRAGMA optimize;');
      }
    });
  }
  
  async getUser(id: string) {
    const users = this.db.collection<User>('users', schema);
    return await users.findById(id);
  }
  
  async close() {
    // Explicit close when service shuts down
    await this.db.close();
  }
  
  // Optional: Implement Symbol.dispose for the service itself
  [Symbol.dispose](): void {
    this.db[Symbol.dispose]();
  }
};

// Usage:
{
  using service = new UserService();
  const user = await service.getUser('123');
} // Service and database both closed
```


### Nested Property Examples

```typescript
interface User extends Document {
  name: string;
  email: string;
  age: number;
  profile: {
    bio: string;
    avatar?: string;
    social: {
      twitter?: string;
      github?: string;
    };
    settings: {
      theme: 'light' | 'dark';
      notifications: {
        email: boolean;
        push: boolean;
      };
    };
  };
  metadata: {
    createdAt: Date;
    lastLogin: Date;
    loginCount: number;
  };
  tags: string[];
};

// Query nested properties with dot notation
const users = db.collection<User>('users', schema);

// Example 1: Query nested string
const result1 = await users.find({
  'profile.bio': { $like: '%engineer%' }
});

// Example 2: Query deeply nested boolean
const result2 = await users.find({
  'profile.settings.notifications.email': true
});

// Example 3: Query nested with comparison operator
const result3 = await users.find({
  'metadata.loginCount': { $gte: 10 }
});

// Example 4: Query nested optional field
const result4 = await users.find({
  'profile.social.github': { $exists: true }
});

// Example 5: Complex nested query
const result5 = await users.find({
  $and: [
    { 'profile.settings.theme': 'dark' },
    { 'profile.settings.notifications.push': true },
    { 'metadata.loginCount': { $gt: 5 } }
  ]
});

// Example 6: Update nested properties (also type-safe)
await users.updateOne('user-id', {
  'profile.bio': 'Updated bio',
  'profile.settings.theme': 'light',
  'metadata.lastLogin': new Date()
});

// Example 7: Sort by nested property
const result6 = await users.find(
  { 'profile.settings.theme': 'dark' },
  { 
    sort: { 'metadata.loginCount': -1 }, // Sort by login count descending
    limit: 10 
  }
);

// Example 8: Projection with nested properties
const result7 = await users.findOne(
  { email: 'alice@example.com' },
  { 
    projection: { 
      name: 1, 
      'profile.bio': 1,
      'profile.settings.theme': 1 
    } 
  }
);
// Returns: { id: '...', name: '...', profile: { bio: '...', settings: { theme: '...' } } }
```

### Schema Definition: When to Use Path Parameter

The `path` parameter is **optional** for top-level fields and **required** for nested properties.

#### Example: Top-Level Fields (Path Omitted)

```typescript
interface User extends Document {
  name: string;
  email: string;
  age: number;
  status: 'active' | 'inactive';
}

const userSchema = createSchema<User>()
  // Top-level fields - path defaults to $.{fieldName}
  .field('name', { type: 'TEXT', indexed: true })        // path: '$.name'
  .field('email', { type: 'TEXT', indexed: true, unique: true })  // path: '$.email'
  .field('age', { type: 'INTEGER', indexed: true })      // path: '$.age'
  .field('status', { type: 'TEXT', indexed: true })      // path: '$.status'
  .build();
```

#### Example: Nested Properties (Path Required)

```typescript
interface User extends Document {
  name: string;
  email: string;
  profile: {
    bio: string;
    avatar?: string;
    settings: {
      theme: 'light' | 'dark';
      notifications: {
        email: boolean;
        push: boolean;
      };
    };
  };
  metadata: {
    createdAt: Date;
    loginCount: number;
  };
}

const userSchema = createSchema<User>()
  // Top-level fields - path omitted (defaults to $.{fieldName})
  .field('name', { type: 'TEXT', indexed: true })
  .field('email', { type: 'TEXT', indexed: true, unique: true })

  // Nested properties - path REQUIRED
  .field('bio', {
    path: '$.profile.bio',           // Maps to nested profile.bio
    type: 'TEXT',
    indexed: true
  })
  .field('theme', {
    path: '$.profile.settings.theme', // Maps to deeply nested theme
    type: 'TEXT',
    indexed: true
  })
  .field('emailNotifications', {
    path: '$.profile.settings.notifications.email',
    type: 'BOOLEAN',
    indexed: true
  })
  .field('loginCount', {
    path: '$.metadata.loginCount',
    type: 'INTEGER',
    indexed: true
  })

  .validate((doc): doc is User => {
    return (
      typeof doc === 'object' &&
      doc !== null &&
      'name' in doc &&
      'profile' in doc
    );
  })
  .build();
```

#### Example: Mixed Top-Level and Nested Fields

```typescript
interface Product extends Document {
  name: string;
  price: number;
  category: string;
  inventory: {
    stock: number;
    warehouse: string;
  };
}

const productSchema = createSchema<Product>()
  // Top-level fields - no path needed
  .field('name', { type: 'TEXT', indexed: true })
  .field('price', { type: 'REAL', indexed: true })
  .field('category', { type: 'TEXT', indexed: true })

  // Nested fields - path required
  .field('stock', {
    path: '$.inventory.stock',
    type: 'INTEGER',
    indexed: true
  })
  .field('warehouse', {
    path: '$.inventory.warehouse',
    type: 'TEXT',
    indexed: true
  })

  // Compound index using both top-level and nested fields
  .compoundIndex('category_stock', ['category', 'stock'])

  .build();

// Now you can query using the field names
await products.find({
  category: 'electronics',
  stock: { $gt: 0 }  // Uses compound index efficiently
});

// This creates a table like:
// CREATE TABLE users (
//   id TEXT PRIMARY KEY,
//   body BLOB NOT NULL,  -- JSONB format
//   _name TEXT GENERATED ALWAYS AS (jsonb_extract(body, '$.name')) VIRTUAL,
//   _email TEXT GENERATED ALWAYS AS (jsonb_extract(body, '$.email')) VIRTUAL,
//   _age INTEGER GENERATED ALWAYS AS (jsonb_extract(body, '$.age')) VIRTUAL,
//   _profileBio TEXT GENERATED ALWAYS AS (jsonb_extract(body, '$.profile.bio')) VIRTUAL,
//   _theme TEXT GENERATED ALWAYS AS (jsonb_extract(body, '$.profile.settings.theme')) VIRTUAL,
//   _emailNotifications BOOLEAN GENERATED ALWAYS AS (jsonb_extract(body, '$.profile.settings.notifications.email')) VIRTUAL,
//   _loginCount INTEGER GENERATED ALWAYS AS (jsonb_extract(body, '$.metadata.loginCount')) VIRTUAL
// );
// 
// CREATE INDEX idx_users_name ON users(_name);
// CREATE INDEX idx_users_email ON users(_email);
// CREATE INDEX idx_users_age ON users(_age);
// CREATE INDEX idx_users_profileBio ON users(_profileBio);
// CREATE INDEX idx_users_theme ON users(_theme);
// CREATE INDEX idx_users_emailNotifications ON users(_emailNotifications);
// CREATE INDEX idx_users_loginCount ON users(_loginCount);
```

### Array of Objects (Nested Arrays)

Querying arrays of objects requires special handling:

```typescript
interface BlogPost extends Document {
  title: string;
  content: string;
  comments: Array<{
    author: string;
    text: string;
    createdAt: Date;
    likes: number;
  }>;
  tags: string[];
};

const posts = db.collection<BlogPost>('posts', schema);

// Query array elements with $elemMatch
const postsWithComment = await posts.find({
  comments: {
    $elemMatch: {
      author: 'Alice',
      likes: { $gte: 10 }
    }
  }
});

// Using jsonb_each internally this translates to:
// SELECT * FROM posts
// WHERE EXISTS (
//   SELECT 1 FROM jsonb_each(body, '$.comments')
//   WHERE jsonb_extract(value, '$.author') = 'Alice'
//     AND jsonb_extract(value, '$.likes') >= 10
// )

// Query array length
const popularPosts = await posts.find({
  comments: { $size: { $gte: 5 } }
});
// Translates to: json_array_length(body, '$.comments') >= 5

// Query if all elements match
const postsWithAllRecentComments = await posts.find({
  comments: {
    $all: [
      { createdAt: { $gte: new Date('2024-01-01') } }
    ]
  }
});
```

### Type Safety for Nested Updates

Updates to nested properties are also type-safe:

```typescript
// ✓ Valid: Update nested property
await users.updateOne('user-id', {
  'profile.bio': 'New bio',
  'profile.settings.theme': 'dark',
  'metadata.loginCount': 42
});

// ✗ Error: Invalid path
await users.updateOne('user-id', {
  'profile.nonexistent': 'value' // TypeScript error
});

// ✗ Error: Invalid value type
await users.updateOne('user-id', {
  'profile.settings.theme': 'blue' // TypeScript error: not 'light' | 'dark'
});

// ✓ Valid: Partial nested update
await users.updateOne('user-id', {
  'profile.settings.notifications.email': false
  // Other nested properties remain unchanged
});

// ✓ Valid: Update entire nested object
await users.updateOne('user-id', {
  profile: {
    bio: 'New bio',
    settings: {
      theme: 'light',
      notifications: {
        email: true,
        push: false
      }
    }
  }
});
```

## Standard Schema Integration

The library uses [Standard Schema](https://standardschema.dev) for validation, allowing you to use any compatible validation library (Zod, Valibot, ArkType, Yup, Effect Schema, TypeBox, and many more).

### Why Standard Schema?

- **Library Agnostic**: Use your preferred validation library
- **Type Safety**: Full TypeScript inference from your schemas
- **Zero Lock-in**: Switch validation libraries without changing collection code
- **Ecosystem Support**: Works with any tool that supports Standard Schema
- **No Runtime Overhead**: Only types are used from the spec

### Installation

```bash
# Install your preferred validation library (all support Standard Schema)
bun add zod                    # Zod
bun add valibot                # Valibot  
bun add arktype                # ArkType
bun add @effect/schema         # Effect Schema
bun add @sinclair/typebox      # TypeBox
bun add yup                    # Yup
# ... any other Standard Schema compatible library

# Optionally install the spec types (or just copy them)
bun add @standard-schema/spec
```

### Examples with Different Libraries

#### Using Zod

```typescript
import { StrataDB, createSchema } from './index';
import { z } from 'zod';

// Define your Zod schema
const UserSchema = z.object({
  id: z.string().optional(), // ID is auto-generated if not provided
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
  tags: z.array(z.string()),
  profile: z.object({
    bio: z.string(),
    avatar: z.string().url().optional(),
    social: z.object({
      twitter: z.string().optional(),
      github: z.string().optional(),
    }).optional(),
    settings: z.object({
      theme: z.enum(['light', 'dark']),
      notifications: z.object({
        email: z.boolean(),
        push: z.boolean(),
      }),
    }),
  }),
  metadata: z.object({
    createdAt: z.date(),
    lastLogin: z.date(),
    loginCount: z.number().int().min(0),
  }),
});

// Infer TypeScript type from schema
type User = z.infer<typeof UserSchema>;

// Create collection with Zod schema
{
  using db = new StrataDB({ database: './mydb.sqlite' });
  
  const users = db.collection<User>(
    'users',
    createSchema<User>()
      .field('name', { type: 'TEXT', indexed: true })
      .field('email', { type: 'TEXT', indexed: true })
      .field('age', { type: 'INTEGER', indexed: true })
      .field('theme', { path: '$.profile.settings.theme', type: 'TEXT', indexed: true })
      .validator(UserSchema) // Pass Zod schema directly
      .build()
  );

  // Insert - automatic validation
  try {
    const user = await users.insertOne({
      name: 'Alice',
      email: 'alice@example.com',
      age: 30,
      tags: ['developer'],
      profile: {
        bio: 'Software engineer',
        settings: {
          theme: 'dark',
          notifications: { email: true, push: false }
        }
      },
      metadata: {
        createdAt: new Date(),
        lastLogin: new Date(),
        loginCount: 0
      }
    });
  } catch (error) {
    // Zod validation errors are automatically caught
    console.error('Validation failed:', error);
  }
};
```

#### Using Valibot

```typescript
import { StrataDB, createSchema } from './index';
import * as v from 'valibot';

// Define your Valibot schema
const UserSchema = v.object({
  id: v.optional(v.string()),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  email: v.pipe(v.string(), v.email()),
  age: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(150)),
  tags: v.array(v.string()),
  profile: v.object({
    bio: v.string(),
    avatar: v.optional(v.pipe(v.string(), v.url())),
    social: v.optional(v.object({
      twitter: v.optional(v.string()),
      github: v.optional(v.string()),
    })),
    settings: v.object({
      theme: v.picklist(['light', 'dark']),
      notifications: v.object({
        email: v.boolean(),
        push: v.boolean(),
      }),
    }),
  }),
  metadata: v.object({
    createdAt: v.date(),
    lastLogin: v.date(),
    loginCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  }),
});

// Infer TypeScript type
type User = v.InferOutput<typeof UserSchema>;

{
  using db = new StrataDB({ database: './mydb.sqlite' });
  
  const users = db.collection<User>(
    'users',
    createSchema<User>()
      .field('name', { type: 'TEXT', indexed: true })
      .field('email', { type: 'TEXT', indexed: true })
      .validator(UserSchema) // Valibot schema
      .build()
  );
};
```

#### Using ArkType

```typescript
import { StrataDB, createSchema } from './index';
import { type } from 'arktype';

// Define your ArkType schema
const UserSchema = type({
  'id?': 'string',
  name: 'string>0<=100',
  email: 'string.email',
  'age': 'integer>=0<=150',
  tags: 'string[]',
  profile: {
    bio: 'string',
    'avatar?': 'string.url',
    'social?': {
      'twitter?': 'string',
      'github?': 'string',
    },
    settings: {
      theme: "'light'|'dark'",
      notifications: {
        email: 'boolean',
        push: 'boolean',
      },
    },
  },
  metadata: {
    createdAt: 'Date',
    lastLogin: 'Date',
    loginCount: 'integer>=0',
  },
});

// Infer TypeScript type
type User = typeof UserSchema.infer;

{
  using db = new StrataDB({ database: './mydb.sqlite' });
  
  const users = db.collection<User>(
    'users',
    createSchema<User>()
      .field('name', { path: '$.name', type: 'TEXT', indexed: true })
      .validator(UserSchema) // ArkType schema
      .build()
  );
};
```

#### Using Effect Schema

```typescript
import { StrataDB, createSchema } from './index';
import * as S from '@effect/schema/Schema';

// Define your Effect schema
const UserSchema = S.Struct({
  id: S.optional(S.String),
  name: S.String.pipe(S.minLength(1), S.maxLength(100)),
  email: S.String.pipe(S.pattern(/^[^@]+@[^@]+$/)),
  age: S.Number.pipe(S.int(), S.between(0, 150)),
  tags: S.Array(S.String),
  profile: S.Struct({
    bio: S.String,
    avatar: S.optional(S.String),
    social: S.optional(S.Struct({
      twitter: S.optional(S.String),
      github: S.optional(S.String),
    })),
    settings: S.Struct({
      theme: S.Literal('light', 'dark'),
      notifications: S.Struct({
        email: S.Boolean,
        push: S.Boolean,
      }),
    }),
  }),
  metadata: S.Struct({
    createdAt: S.Date,
    lastLogin: S.Date,
    loginCount: S.Number.pipe(S.int(), S.greaterThanOrEqualTo(0)),
  }),
});

// Infer TypeScript type
type User = S.Schema.Type<typeof UserSchema>;

{
  using db = new StrataDB({ database: './mydb.sqlite' });
  
  const users = db.collection<User>(
    'users',
    createSchema<User>()
      .field('name', { path: '$.name', type: 'TEXT', indexed: true })
      .validator(UserSchema) // Effect Schema
      .build()
  );
};
```

### Validation Behavior

```typescript
// Validation happens automatically on:
// 1. insertOne() - validates before insert
const user = await users.insertOne({
  name: 'Alice',
  email: 'invalid-email', // Validation error thrown
  // ...
});

// 2. insertMany() - validates each document
const results = await users.insertMany([
  { name: 'Alice', email: 'alice@example.com', ... },
  { name: 'Bob', email: 'invalid', ... }, // Error on second doc
]);

// 3. updateOne() - validates the updated document
await users.updateOne('user-id', {
  email: 'invalid-email' // Validation error
});

// 4. replaceOne() - validates the entire replacement
await users.replaceOne('user-id', {
  name: 'Alice',
  email: 'invalid', // Validation error
  // ...
});

// Manual validation (if needed)
const doc = { name: 'Alice', email: 'alice@example.com', ... };

// Async validation
const validated = await users.validate(doc);

// Sync validation (throws on error)
try {
  const validated = users.validateSync(doc);
} catch (error) {
  // Handle validation error
  if (error.issues) {
    console.error('Validation failed:', error.issues);
  }
};
```

### Validation Error Handling

```typescript
import { StrataDB, createSchema, ValidationError } from './index';
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().int().min(0),
});

type User = z.infer<typeof UserSchema>;

{
  using db = new StrataDB({ database: './mydb.sqlite' });
  
  const users = db.collection<User>(
    'users',
    createSchema<User>()
      .field('name', { path: '$.name', type: 'TEXT', indexed: true })
      .validator(UserSchema)
      .build()
  );

  try {
    await users.insertOne({
      name: 'Alice',
      email: 'not-an-email', // Invalid
      age: -5, // Invalid
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      // Standard Schema validation issues
      console.error('Validation failed:');
      error.issues.forEach(issue => {
        console.error(`  - ${issue.path?.join('.')}: ${issue.message}`);
      });
      
      // Example output:
      // Validation failed:
      //   - email: Invalid email
      //   - age: Number must be greater than or equal to 0
    }
  }
};
```

### Custom Validation Error Class

```typescript
export class ValidationError extends Error {
  constructor(
    public readonly issues: ReadonlyArray<StandardSchemaV1.Issue>
  ) {
    super(
      'Validation failed:\n' +
      issues.map(i => `  - ${i.path?.join('.') || 'root'}: ${i.message}`).join('\n')
    );
    this.name = 'ValidationError';
  }
};
```

### Synchronous vs Asynchronous Validation

```typescript
// Most validators support both sync and async
// The library handles both automatically

// Async validation (safest, supports all validators)
const user = await users.insertOne(data);

// Sync validation (faster, but may throw if validator is async-only)
try {
  const user = users.insertOneSync(data);
} catch (error) {
  if (error.message.includes('async')) {
    console.error('This validator requires async validation');
  }
};
```

### Type Inference Benefits

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  profile: z.object({
    bio: z.string(),
    settings: z.object({
      theme: z.enum(['light', 'dark']),
    }),
  }),
});

type User = z.infer<typeof UserSchema>;

// TypeScript knows the exact shape:
const users = db.collection<User>('users', schema);

// All queries are fully typed:
const darkThemeUsers = await users.find({
  'profile.settings.theme': 'dark' // ✓ TypeScript knows this path exists
});

// Updates are typed:
await users.updateOne('id', {
  'profile.settings.theme': 'blue' // ✗ Error: invalid value
});
```

### Switching Validation Libraries

Since Standard Schema is just an interface, you can switch libraries with minimal changes:

```typescript
// Before: Using Zod
import { z } from 'zod';
const UserSchema = z.object({ name: z.string() });

// After: Using Valibot (just change the import and syntax)
import * as v from 'valibot';
const UserSchema = v.object({ name: v.string() });

// Collection code stays the same!
const users = db.collection<User>(
  'users',
  createSchema<User>()
    .validator(UserSchema) // Works with either!
    .build()
);
```


## 10. Testing Strategy

### 10.1 Testing Philosophy

StrataDB requires extensive testing to ensure:
- **Data Integrity**: Documents are stored and retrieved correctly
- **Query Correctness**: All query operators work as expected with proper type safety
- **Performance**: Operations meet performance benchmarks
- **Edge Cases**: Circular references, deeply nested objects, malformed data
- **Concurrency**: Multiple simultaneous operations don't corrupt data
- **Schema Validation**: Standard Schema integration works correctly
- **Resource Management**: `using` statements properly dispose resources

### 10.2 Test Categories

#### 10.2.1 Unit Tests

**Core Functionality Tests**
```typescript
// Document insertion
describe('StrataDB.insert()', () => {
  test('inserts simple document with auto-generated ID', async () => {
    using db = await createTestDB();
    const users = db.collection('users');
    const result = await users.insert({ name: 'Alice', age: 30 });
    
    expect(result._id).toBeDefined();
    expect(result.name).toBe('Alice');
    expect(result.age).toBe(30);
  });

  test('inserts document with custom ID', async () => {
    using db = await createTestDB();
    const users = db.collection('users');
    const result = await users.insert({ 
      _id: 'user-1', 
      name: 'Bob' 
    });
    
    expect(result._id).toBe('user-1');
  });

  test('throws on duplicate ID', async () => {
    using db = await createTestDB();
    const users = db.collection('users');
    await users.insert({ _id: 'user-1', name: 'Alice' });
    
    await expect(
      users.insert({ _id: 'user-1', name: 'Bob' })
    ).rejects.toThrow(DuplicateKeyError);
  });

  test('handles circular references in documents', async () => {
    using db = await createTestDB();
    const docs = db.collection('docs');
    const obj: any = { name: 'circular' };
    obj.self = obj;
    
    const result = await docs.insert(obj);
    expect(result.self).toBe('[Circular]');
  });

  test('preserves nested object structure', async () => {
    using db = await createTestDB();
    const users = db.collection('users');
    const result = await users.insert({
      name: 'Charlie',
      address: {
        street: '123 Main St',
        city: 'NYC',
        coordinates: { lat: 40.7128, lng: -74.0060 }
      }
    });
    
    expect(result.address.coordinates.lat).toBe(40.7128);
  });
});
```

**Query Operator Tests**
```typescript
describe('Query Operators', () => {
  // Comparison operators
  describe('$eq', () => {
    test('matches exact values', async () => {
      using db = await createTestDB();
      const users = await seedUsers(db);
      const results = await users.find({ age: { $eq: 30 } });
      
      expect(results.every(u => u.age === 30)).toBe(true);
    });

    test('matches nested properties', async () => {
      using db = await createTestDB();
      const users = await seedUsers(db);
      const results = await users.find({ 
        'address.city': { $eq: 'NYC' } 
      });
      
      expect(results.every(u => u.address.city === 'NYC')).toBe(true);
    });
  });

  describe('$gt, $gte, $lt, $lte', () => {
    test('$gt filters correctly', async () => {
      using db = await createTestDB();
      const users = await seedUsers(db);
      const results = await users.find({ age: { $gt: 25 } });
      
      expect(results.every(u => u.age > 25)).toBe(true);
    });

    test('$gte includes boundary', async () => {
      using db = await createTestDB();
      const users = await seedUsers(db);
      const results = await users.find({ age: { $gte: 25 } });
      
      expect(results.every(u => u.age >= 25)).toBe(true);
      expect(results.some(u => u.age === 25)).toBe(true);
    });

    test('works with dates', async () => {
      using db = await createTestDB();
      const events = db.collection('events');
      const cutoff = new Date('2024-01-01');
      
      await events.insertMany([
        { name: 'Old', date: new Date('2023-12-31') },
        { name: 'New', date: new Date('2024-01-02') }
      ]);
      
      const results = await events.find({ 
        date: { $gt: cutoff } 
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('New');
    });
  });

  describe('$in, $nin', () => {
    test('$in matches array of values', async () => {
      using db = await createTestDB();
      const users = await seedUsers(db);
      const results = await users.find({ 
        status: { $in: ['active', 'pending'] } 
      });
      
      expect(results.every(u => 
        ['active', 'pending'].includes(u.status)
      )).toBe(true);
    });

    test('$nin excludes array of values', async () => {
      using db = await createTestDB();
      const users = await seedUsers(db);
      const results = await users.find({ 
        status: { $nin: ['deleted', 'suspended'] } 
      });
      
      expect(results.every(u => 
        !['deleted', 'suspended'].includes(u.status)
      )).toBe(true);
    });
  });

  describe('$exists', () => {
    test('matches when field exists', async () => {
      using db = await createTestDB();
      const users = db.collection('users');
      
      await users.insertMany([
        { name: 'Alice', email: 'alice@example.com' },
        { name: 'Bob' }
      ]);
      
      const results = await users.find({ 
        email: { $exists: true } 
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Alice');
    });

    test('matches when field does not exist', async () => {
      using db = await createTestDB();
      const users = db.collection('users');
      
      await users.insertMany([
        { name: 'Alice', email: 'alice@example.com' },
        { name: 'Bob' }
      ]);
      
      const results = await users.find({ 
        email: { $exists: false } 
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Bob');
    });
  });

  describe('String Operators', () => {
    test('$endsWith matches suffix', async () => {
      using db = await createTestDB();
      const users = await seedUsers(db);
      const results = await users.find({
        email: { $endsWith: '@example.com' }
      });

      expect(results.every(u =>
        u.email.endsWith('@example.com')
      )).toBe(true);
    });

    test('$like matches pattern', async () => {
      using db = await createTestDB();
      const users = await seedUsers(db);
      const results = await users.find({
        name: { $like: '%alice%' }
      });

      expect(results.some(u => u.name.toLowerCase().includes('alice'))).toBe(true);
    });

    test('$startsWith matches prefix', async () => {
      using db = await createTestDB();
      const users = await seedUsers(db);
      const results = await users.find({
        name: { $startsWith: 'A' }
      });

      expect(results.every(u => u.name.startsWith('A'))).toBe(true);
    });
  });

  describe('Array Operators', () => {
    describe('$all', () => {
      test('matches arrays containing all elements', async () => {
        using db = await createTestDB();
        const users = db.collection('users');
        
        await users.insertMany([
          { name: 'Alice', tags: ['admin', 'developer', 'designer'] },
          { name: 'Bob', tags: ['developer'] }
        ]);
        
        const results = await users.find({ 
          tags: { $all: ['developer', 'admin'] } 
        });
        
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Alice');
      });
    });

    describe('$elemMatch', () => {
      test('matches array elements with conditions', async () => {
        using db = await createTestDB();
        const orders = db.collection('orders');
        
        await orders.insertMany([
          { 
            customer: 'Alice', 
            items: [
              { name: 'Widget', price: 10 },
              { name: 'Gadget', price: 50 }
            ]
          },
          { 
            customer: 'Bob', 
            items: [
              { name: 'Thing', price: 5 }
            ]
          }
        ]);
        
        const results = await orders.find({ 
          items: { 
            $elemMatch: { 
              price: { $gt: 20 } 
            } 
          } 
        });
        
        expect(results).toHaveLength(1);
        expect(results[0].customer).toBe('Alice');
      });
    });

    describe('$size', () => {
      test('matches array by length', async () => {
        using db = await createTestDB();
        const users = db.collection('users');
        
        await users.insertMany([
          { name: 'Alice', tags: ['a', 'b', 'c'] },
          { name: 'Bob', tags: ['x'] }
        ]);
        
        const results = await users.find({ 
          tags: { $size: 3 } 
        });
        
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Alice');
      });
    });
  });

  describe('Logical Operators', () => {
    describe('$and', () => {
      test('combines multiple conditions', async () => {
        using db = await createTestDB();
        const users = await seedUsers(db);
        const results = await users.find({ 
          $and: [
            { age: { $gte: 25 } },
            { status: 'active' }
          ]
        });
        
        expect(results.every(u => 
          u.age >= 25 && u.status === 'active'
        )).toBe(true);
      });
    });

    describe('$or', () => {
      test('matches any condition', async () => {
        using db = await createTestDB();
        const users = await seedUsers(db);
        const results = await users.find({ 
          $or: [
            { age: { $lt: 20 } },
            { age: { $gt: 60 } }
          ]
        });
        
        expect(results.every(u => 
          u.age < 20 || u.age > 60
        )).toBe(true);
      });
    });

    describe('$nor', () => {
      test('matches none of the conditions', async () => {
        using db = await createTestDB();
        const users = await seedUsers(db);
        const results = await users.find({ 
          $nor: [
            { status: 'deleted' },
            { status: 'suspended' }
          ]
        });
        
        expect(results.every(u => 
          u.status !== 'deleted' && u.status !== 'suspended'
        )).toBe(true);
      });
    });

    describe('$not', () => {
      test('negates condition', async () => {
        using db = await createTestDB();
        const users = await seedUsers(db);
        const results = await users.find({ 
          age: { $not: { $lt: 18 } } 
        });
        
        expect(results.every(u => u.age >= 18)).toBe(true);
      });
    });
  });
});
```

**Update Operator Tests**
```typescript
describe('Update Operators', () => {
  describe('$set', () => {
    test('sets field value', async () => {
      using db = await createTestDB();
      const users = db.collection('users');
      const { _id } = await users.insert({ name: 'Alice', age: 30 });
      
      await users.updateOne(
        { _id },
        { $set: { age: 31 } }
      );
      
      const updated = await users.findOne({ _id });
      expect(updated.age).toBe(31);
    });

    test('sets nested field', async () => {
      using db = await createTestDB();
      const users = db.collection('users');
      const { _id } = await users.insert({ 
        name: 'Alice',
        address: { city: 'NYC' }
      });
      
      await users.updateOne(
        { _id },
        { $set: { 'address.city': 'LA' } }
      );
      
      const updated = await users.findOne({ _id });
      expect(updated.address.city).toBe('LA');
    });
  });

  describe('$inc', () => {
    test('increments numeric field', async () => {
      using db = await createTestDB();
      const users = db.collection('users');
      const { _id } = await users.insert({ name: 'Alice', score: 10 });
      
      await users.updateOne(
        { _id },
        { $inc: { score: 5 } }
      );
      
      const updated = await users.findOne({ _id });
      expect(updated.score).toBe(15);
    });

    test('decrements with negative value', async () => {
      using db = await createTestDB();
      const users = db.collection('users');
      const { _id } = await users.insert({ name: 'Alice', score: 10 });
      
      await users.updateOne(
        { _id },
        { $inc: { score: -3 } }
      );
      
      const updated = await users.findOne({ _id });
      expect(updated.score).toBe(7);
    });
  });

  describe('$push', () => {
    test('appends to array', async () => {
      using db = await createTestDB();
      const users = db.collection('users');
      const { _id } = await users.insert({ 
        name: 'Alice', 
        tags: ['a', 'b'] 
      });
      
      await users.updateOne(
        { _id },
        { $push: { tags: 'c' } }
      );
      
      const updated = await users.findOne({ _id });
      expect(updated.tags).toEqual(['a', 'b', 'c']);
    });

    test('$each pushes multiple values', async () => {
      using db = await createTestDB();
      const users = db.collection('users');
      const { _id } = await users.insert({ 
        name: 'Alice', 
        tags: ['a'] 
      });
      
      await users.updateOne(
        { _id },
        { $push: { tags: { $each: ['b', 'c'] } } }
      );
      
      const updated = await users.findOne({ _id });
      expect(updated.tags).toEqual(['a', 'b', 'c']);
    });
  });

  describe('$pull', () => {
    test('removes matching elements', async () => {
      using db = await createTestDB();
      const users = db.collection('users');
      const { _id } = await users.insert({ 
        name: 'Alice', 
        tags: ['a', 'b', 'c', 'b'] 
      });
      
      await users.updateOne(
        { _id },
        { $pull: { tags: 'b' } }
      );
      
      const updated = await users.findOne({ _id });
      expect(updated.tags).toEqual(['a', 'c']);
    });
  });

  describe('$unset', () => {
    test('removes field', async () => {
      using db = await createTestDB();
      const users = db.collection('users');
      const { _id } = await users.insert({ 
        name: 'Alice',
        temp: 'delete me' 
      });
      
      await users.updateOne(
        { _id },
        { $unset: { temp: '' } }
      );
      
      const updated = await users.findOne({ _id });
      expect(updated).not.toHaveProperty('temp');
    });
  });
});
```

#### 10.2.2 Integration Tests

**Transaction Tests**
```typescript
describe('Transactions', () => {
  test('commits successful transaction', async () => {
    using db = await createTestDB();
    const users = db.collection('users');
    const orders = db.collection('orders');
    
    await db.transaction(async (tx) => {
      const user = await tx.collection('users').insert({
        name: 'Alice',
        balance: 100
      });
      
      await tx.collection('orders').insert({
        userId: user._id,
        amount: 50
      });
      
      await tx.collection('users').updateOne(
        { _id: user._id },
        { $inc: { balance: -50 } }
      );
    });
    
    const user = await users.findOne({ name: 'Alice' });
    expect(user.balance).toBe(50);
    
    const orderCount = await orders.count({ userId: user._id });
    expect(orderCount).toBe(1);
  });

  test('rolls back on error', async () => {
    using db = await createTestDB();
    const users = db.collection('users');
    
    await expect(
      db.transaction(async (tx) => {
        await tx.collection('users').insert({
          name: 'Alice'
        });
        
        throw new Error('Intentional error');
      })
    ).rejects.toThrow('Intentional error');
    
    const count = await users.count();
    expect(count).toBe(0);
  });

  test('handles nested transactions (savepoints)', async () => {
    using db = await createTestDB();
    const users = db.collection('users');
    
    await db.transaction(async (tx) => {
      await tx.collection('users').insert({ name: 'Alice' });
      
      await tx.transaction(async (nested) => {
        await nested.collection('users').insert({ name: 'Bob' });
      });
      
      await tx.collection('users').insert({ name: 'Charlie' });
    });
    
    expect(await users.count()).toBe(3);
  });
});
```

**Schema Validation Tests**
```typescript
import { z } from 'zod';

describe('Schema Validation', () => {
  test('validates on insert', async () => {
    using db = await createTestDB();
    const userSchema = z.object({
      name: z.string().min(1),
      age: z.number().int().min(0),
      email: z.string().email()
    });
    
    const users = db.collection('users', { schema: userSchema });
    
    await expect(
      users.insert({ 
        name: '', 
        age: -5, 
        email: 'invalid' 
      })
    ).rejects.toThrow(ValidationError);
  });

  test('allows valid documents', async () => {
    using db = await createTestDB();
    const userSchema = z.object({
      name: z.string().min(1),
      age: z.number().int().min(0),
      email: z.string().email()
    });
    
    const users = db.collection('users', { schema: userSchema });
    
    const result = await users.insert({
      name: 'Alice',
      age: 30,
      email: 'alice@example.com'
    });
    
    expect(result._id).toBeDefined();
  });

  test('validates on update', async () => {
    using db = await createTestDB();
    const userSchema = z.object({
      name: z.string().min(1),
      age: z.number().int().min(0)
    });
    
    const users = db.collection('users', { schema: userSchema });
    const { _id } = await users.insert({ name: 'Alice', age: 30 });
    
    await expect(
      users.updateOne(
        { _id },
        { $set: { age: -5 } }
      )
    ).rejects.toThrow(ValidationError);
  });
});
```

**Concurrency Tests**
```typescript
describe('Concurrency', () => {
  test('handles simultaneous inserts', async () => {
    using db = await createTestDB();
    const users = db.collection('users');
    
    const insertPromises = Array.from({ length: 100 }, (_, i) =>
      users.insert({ name: `User ${i}`, index: i })
    );
    
    await Promise.all(insertPromises);
    
    const count = await users.count();
    expect(count).toBe(100);
  });

  test('handles concurrent updates to same document', async () => {
    using db = await createTestDB();
    const counters = db.collection('counters');
    const { _id } = await counters.insert({ value: 0 });
    
    const updatePromises = Array.from({ length: 50 }, () =>
      counters.updateOne(
        { _id },
        { $inc: { value: 1 } }
      )
    );
    
    await Promise.all(updatePromises);
    
    const result = await counters.findOne({ _id });
    expect(result.value).toBe(50);
  });

  test('handles concurrent reads and writes', async () => {
    using db = await createTestDB();
    const users = db.collection('users');
    
    // Seed some data
    await users.insertMany(
      Array.from({ length: 100 }, (_, i) => ({
        name: `User ${i}`,
        score: Math.floor(Math.random() * 100)
      }))
    );
    
    const operations = [
      ...Array.from({ length: 20 }, () => 
        users.find({ score: { $gt: 50 } })
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        users.insert({ name: `New User ${i}`, score: 75 })
      ),
      ...Array.from({ length: 10 }, () =>
        users.updateMany(
          { score: { $lt: 25 } },
          { $inc: { score: 10 } }
        )
      )
    ];
    
    await Promise.all(operations);
    
    // Verify database integrity
    const allUsers = await users.find({});
    expect(allUsers).toHaveLength(110);
  });
});
```

#### 10.2.3 Performance Tests

```typescript
describe('Performance', () => {
  test('inserts 10,000 documents in < 1 second', async () => {
    using db = await createTestDB();
    const users = db.collection('users');
    
    const docs = Array.from({ length: 10000 }, (_, i) => ({
      name: `User ${i}`,
      age: 20 + (i % 50),
      email: `user${i}@example.com`,
      tags: [`tag${i % 10}`, `tag${i % 20}`]
    }));
    
    const start = performance.now();
    await users.insertMany(docs);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(1000);
  });

  test('queries 10,000 documents in < 100ms', async () => {
    using db = await createTestDB();
    const users = db.collection('users');
    
    // Seed data
    await users.insertMany(
      Array.from({ length: 10000 }, (_, i) => ({
        name: `User ${i}`,
        age: 20 + (i % 50),
        status: i % 2 === 0 ? 'active' : 'inactive'
      }))
    );
    
    const start = performance.now();
    const results = await users.find({ 
      age: { $gte: 30, $lt: 40 },
      status: 'active'
    });
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(100);
    expect(results.length).toBeGreaterThan(0);
  });

  test('deeply nested queries perform efficiently', async () => {
    using db = await createTestDB();
    const docs = db.collection('docs');
    
    await docs.insertMany(
      Array.from({ length: 1000 }, (_, i) => ({
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: i,
                  active: i % 2 === 0
                }
              }
            }
          }
        }
      }))
    );
    
    const start = performance.now();
    const results = await docs.find({
      'level1.level2.level3.level4.level5.active': true
    });
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(200);
    expect(results).toHaveLength(500);
  });

  test('updates with array operators scale', async () => {
    using db = await createTestDB();
    const users = db.collection('users');
    
    await users.insertMany(
      Array.from({ length: 1000 }, (_, i) => ({
        name: `User ${i}`,
        tags: [`tag${i % 10}`]
      }))
    );
    
    const start = performance.now();
    await users.updateMany(
      {},
      { $push: { tags: 'new-tag' } }
    );
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(500);
  });
});
```

#### 10.2.4 Edge Case Tests

```typescript
describe('Edge Cases', () => {
  test('handles empty queries', async () => {
    using db = await createTestDB();
    const users = db.collection('users');
    await users.insertMany([
      { name: 'Alice' },
      { name: 'Bob' }
    ]);
    
    const results = await users.find({});
    expect(results).toHaveLength(2);
  });

  test('handles very deep nesting (100+ levels)', async () => {
    using db = await createTestDB();
    const docs = db.collection('docs');
    
    let nested: any = { value: 'deepest' };
    for (let i = 0; i < 100; i++) {
      nested = { level: nested };
    }
    
    const result = await docs.insert(nested);
    expect(result._id).toBeDefined();
  });

  test('handles documents with 1000+ fields', async () => {
    using db = await createTestDB();
    const docs = db.collection('docs');
    
    const largeDoc: any = {};
    for (let i = 0; i < 1000; i++) {
      largeDoc[`field${i}`] = `value${i}`;
    }
    
    const result = await docs.insert(largeDoc);
    expect(Object.keys(result)).toHaveLength(1001); // +1 for _id
  });

  test('handles null and undefined values', async () => {
    using db = await createTestDB();
    const docs = db.collection('docs');
    
    const result = await docs.insert({
      nullField: null,
      undefinedField: undefined,
      normalField: 'value'
    });
    
    expect(result.nullField).toBeNull();
    expect(result).not.toHaveProperty('undefinedField');
  });

  test('handles special characters in field names', async () => {
    using db = await createTestDB();
    const docs = db.collection('docs');
    
    const result = await docs.insert({
      'field.with.dots': 'value',
      'field$with$dollars': 'value',
      'field-with-dashes': 'value'
    });
    
    expect(result['field.with.dots']).toBe('value');
  });

  test('handles Unicode in field values', async () => {
    using db = await createTestDB();
    const docs = db.collection('docs');
    
    const result = await docs.insert({
      emoji: '🚀',
      chinese: '你好',
      arabic: 'مرحبا',
      russian: 'привет'
    });
    
    expect(result.emoji).toBe('🚀');
  });

  test('handles very large arrays (10,000+ elements)', async () => {
    using db = await createTestDB();
    const docs = db.collection('docs');
    
    const result = await docs.insert({
      largeArray: Array.from({ length: 10000 }, (_, i) => i)
    });
    
    expect(result.largeArray).toHaveLength(10000);
  });

  test('query on non-existent field returns empty', async () => {
    using db = await createTestDB();
    const users = db.collection('users');
    await users.insert({ name: 'Alice' });
    
    const results = await users.find({ 
      nonExistentField: 'value' 
    });
    
    expect(results).toHaveLength(0);
  });
});
```

#### 10.2.5 Resource Management Tests

```typescript
describe('Resource Management (using statements)', () => {
  test('database is disposed after using block', async () => {
    let dbWasDisposed = false;
    
    {
      using db = await StrataDB.create(':memory:', {
        onClose: async () => {
          dbWasDisposed = true;
        }
      });
      
      const users = db.collection('users');
      await users.insert({ name: 'Alice' });
    }
    
    // Give async cleanup time to complete
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(dbWasDisposed).toBe(true);
  });

  test('collection is disposed after using block', async () => {
    using db = await createTestDB();
    
    {
      using users = db.collection('users');
      await users.insert({ name: 'Alice' });
    }
    
    // Collection should still be accessible through db
    const users2 = db.collection('users');
    const count = await users2.count();
    expect(count).toBe(1);
  });

  test('nested using statements dispose in correct order', async () => {
    const disposalOrder: string[] = [];
    
    {
      using db = await StrataDB.create(':memory:', {
        onClose: async () => {
          disposalOrder.push('db');
        }
      });
      
      {
        using users = db.collection('users');
        await users.insert({ name: 'Alice' });
        disposalOrder.push('users-used');
      }
      
      disposalOrder.push('after-users-block');
    }
    
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(disposalOrder).toEqual([
      'users-used',
      'after-users-block',
      'db'
    ]);
  });

  test('error in using block still disposes resources', async () => {
    let dbWasDisposed = false;
    
    await expect(async () => {
      using db = await StrataDB.create(':memory:', {
        onClose: async () => {
          dbWasDisposed = true;
        }
      });
      
      throw new Error('Test error');
    }).rejects.toThrow('Test error');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(dbWasDisposed).toBe(true);
  });
});
```

### 10.3 Test Data Utilities

```typescript
// test/helpers.ts
export async function createTestDB(): Promise<StrataDB> {
  return await StrataDB.create(':memory:');
};

export async function seedUsers(db: StrataDB) {
  const users = db.collection('users');
  await users.insertMany([
    { 
      name: 'Alice', 
      age: 30, 
      email: 'alice@example.com',
      status: 'active',
      address: { city: 'NYC', country: 'USA' },
      tags: ['developer', 'admin']
    },
    { 
      name: 'Bob', 
      age: 25, 
      email: 'bob@example.com',
      status: 'active',
      address: { city: 'LA', country: 'USA' },
      tags: ['developer']
    },
    { 
      name: 'Charlie', 
      age: 35, 
      email: 'charlie@example.com',
      status: 'inactive',
      address: { city: 'Chicago', country: 'USA' },
      tags: ['designer']
    },
    { 
      name: 'Diana', 
      age: 28, 
      email: 'diana@example.com',
      status: 'active',
      address: { city: 'NYC', country: 'USA' },
      tags: ['developer', 'designer']
    }
  ]);
  
  return users;
};

export function expectDeepEqual(actual: unknown, expected: unknown) {
  expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
};
```

### 10.4 Test Coverage Requirements

- **Code Coverage**: Minimum 95% statement, branch, and function coverage
- **Query Operators**: 100% of all operators must have dedicated tests
- **Error Paths**: All error conditions must be tested
- **Type Safety**: All type assertions must be validated at test time
- **Performance Benchmarks**: All critical paths must have performance tests

### 10.5 Continuous Integration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      
      - name: Install dependencies
        run: bun install
      
      - name: Run linter
        run: bun run lint
      
      - name: Run type check
        run: bun run typecheck
      
      - name: Run unit tests
        run: bun test --coverage
      
      - name: Run performance tests
        run: bun test:perf
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### 10.6 Test Documentation

Each test category should include:
- **Purpose**: What the test validates
- **Setup**: Required test fixtures and data
- **Assertions**: Expected outcomes
- **Edge Cases**: Known limitations or special behaviors
- **Performance Expectations**: Timing requirements for performance tests
