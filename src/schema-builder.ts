import type { Document } from "./core-types.js"
import type { JsonPath, SchemaFieldName } from "./path-types.js"
import type {
  FieldDefinitionOptions,
  SchemaBuilder,
} from "./schema-builder-types.js"
import type {
  CompoundIndex,
  SchemaDefinition,
  SchemaField,
  TimestampConfig,
  TypeScriptToSQLite,
} from "./schema-types.js"

/**
 * Concrete implementation of the SchemaBuilder interface.
 *
 * @typeParam T - The document type extending Document
 *
 * @remarks
 * This class provides a fluent API for building schemas through method chaining.
 * It accumulates configuration in private fields and returns an immutable
 * SchemaDefinition when build() is called.
 *
 * The implementation ensures:
 * - Type safety at every step
 * - Proper path defaulting for top-level fields
 * - Immutable final schema definition
 * - Clean developer experience
 *
 * @internal
 * This class is not exported directly. Use createSchema<T>() instead.
 *
 * @example
 * ```typescript
 * // Don't instantiate directly - use createSchema<T>()
 * const schema = createSchema<User>()
 *   .field('name', { type: 'TEXT', indexed: true })
 *   .build();
 * ```
 */
class SchemaBuilderImpl<T extends Document> implements SchemaBuilder<T> {
  /** Accumulated field definitions */
  private readonly fields: SchemaField<T, keyof T>[] = []

  /** Accumulated compound indexes */
  private readonly compoundIndexes: CompoundIndex<T>[] = []

  /** Timestamp configuration */
  private timestampConfig?: TimestampConfig

  /** Validation function */
  private validator?: (doc: unknown) => doc is T

  /**
   * Define an indexed field with type checking.
   *
   * @param name - The field name (supports dot notation for nested fields, e.g., 'profile.bio' or 'watchlistItem.ticker')
   * @param options - Field configuration options
   * @returns This builder instance for method chaining
   *
   * @remarks
   * Field names support dot notation for accessing nested properties.
   * When a dot is detected in the name, it automatically becomes the JSON path.
   *
   * For top-level fields, the path defaults to `$.{name}`.
   * For nested fields like 'profile.bio', the path becomes '$.profile.bio'.
   * For deeply nested fields like 'user.profile.settings.theme', the path becomes '$.user.profile.settings.theme'.
   *
   * @example
   * ```typescript
   * builder
   *   // Top-level fields
   *   .field('name', { type: 'TEXT', indexed: true })
   *   .field('email', { type: 'TEXT', indexed: true, unique: true })
   *
   *   // Nested fields (dot notation automatically becomes JSON path)
   *   .field('profile.bio', { type: 'TEXT', indexed: true })
   *   .field('watchlistItem.ticker', { type: 'TEXT', indexed: true })
   *   .field('watchlistItem.symbol', { type: 'TEXT', indexed: true })
   *   .field('user.settings.theme', { type: 'TEXT', indexed: true })
   * ```
   */
  field<K extends SchemaFieldName<T>>(
    name: K,
    options: FieldDefinitionOptions
  ): SchemaBuilder<T> {
    return this.fieldUnchecked(name, options)
  }

  fieldUnchecked(
    name: string,
    options: FieldDefinitionOptions
  ): SchemaBuilder<T> {
    // If path is explicitly provided, use it
    // Otherwise, if name contains a dot, it's a nested field - use as JSON path
    // Otherwise, it's a top-level field - use $.{name}
    const path =
      options.path ??
      (String(name).includes(".")
        ? (`$.${String(name)}` as JsonPath)
        : (`$.${String(name)}` as JsonPath))

    // Build field object conditionally to avoid undefined values
    const field: SchemaField<T, keyof T> = {
      name: name as keyof T,
      path,
      type: options.type as TypeScriptToSQLite<T[keyof T]>,
      ...(options.nullable !== undefined && { nullable: options.nullable }),
      ...(options.indexed !== undefined && { indexed: options.indexed }),
      ...(options.unique !== undefined && { unique: options.unique }),
      ...(options.default !== undefined && {
        default: options.default as T[keyof T],
      }),
    }

    this.fields.push(field)

    return this
  }

  /**
   * Define a compound index spanning multiple fields.
   *
   * @param name - Unique name for the index
   * @param fields - Array of field names (order matters, supports dot notation for nested fields)
   * @param options - Index options (unique constraint)
   * @returns This builder instance for method chaining
   *
   * @remarks
   * Field names can use dot notation to reference nested properties.
   * Checked field names must be document keys or dotted document paths.
   * This allows compound indexes across both top-level and nested fields.
   *
   * @example
   * ```typescript
   * builder
   *   // Simple compound index
   *   .compoundIndex('age_status', ['age', 'status'])
   *
   *   // Compound index with nested fields (using dot notation)
   *   .compoundIndex('watchlist_active', ['watchlistItem.ticker', 'isActive'])
   *
   *   // Unique compound constraint
   *   .compoundIndex('email_tenant', ['email', 'tenantId'], { unique: true })
   * ```
   */
  compoundIndex(
    name: string,
    fields: readonly SchemaFieldName<T>[],
    options?: { readonly unique?: boolean }
  ): SchemaBuilder<T> {
    return this.compoundIndexUnchecked(name, fields, options)
  }

  compoundIndexUnchecked(
    name: string,
    fields: readonly string[],
    options?: { readonly unique?: boolean }
  ): SchemaBuilder<T> {
    const index: CompoundIndex<T> = {
      name,
      fields: fields as readonly (keyof T)[],
      ...(options?.unique !== undefined && { unique: options.unique }),
    }

    this.compoundIndexes.push(index)

    return this
  }

  /**
   * Enable automatic timestamp management.
   *
   * @param enabled - Whether to auto-manage createdAt/updatedAt (default: true)
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * builder.timestamps(true)
   * ```
   */
  timestamps(enabled = true): SchemaBuilder<T> {
    this.timestampConfig = enabled
    return this
  }

  /**
   * Add validation function using a type predicate.
   *
   * @param validator - Function that validates and narrows the document type
   * @returns This builder instance for method chaining
   *
   * @example
   * ```typescript
   * builder.validate((doc): doc is User => {
   *   return typeof doc === 'object' &&
   *          doc !== null &&
   *          'name' in doc &&
   *          typeof doc.name === 'string';
   * })
   * ```
   */
  validate(validator: (doc: unknown) => doc is T): SchemaBuilder<T> {
    this.validator = validator
    return this
  }

  /**
   * Build and return the complete, immutable schema definition.
   *
   * @returns The immutable schema definition
   *
   * @remarks
   * Freezes the schema definition to prevent accidental modification.
   * The returned object is completely immutable at all levels.
   *
   * @example
   * ```typescript
   * const schema = builder.build();
   * // schema is now immutable
   * ```
   */
  build(): SchemaDefinition<T> {
    const definition: SchemaDefinition<T> = {
      fields: Object.freeze([...this.fields]),
      ...(this.compoundIndexes.length > 0 && {
        compoundIndexes: Object.freeze([...this.compoundIndexes]),
      }),
      ...(this.timestampConfig !== undefined && {
        timestamps: this.timestampConfig,
      }),
      ...(this.validator !== undefined && {
        validate: this.validator,
      }),
    }

    return Object.freeze(definition)
  }
}

/**
 * Creates a new schema builder for defining collection schemas.
 *
 * @typeParam T - The document payload type (without _id, createdAt, updatedAt)
 * @returns A new SchemaBuilder instance for `Document<T>`
 *
 * @remarks
 * This factory function creates a new `SchemaBuilder<Document<T>>` that provides
 * a fluent API for constructing schemas. The builder ensures type safety
 * at every step and returns an immutable schema definition when built.
 *
 * **Important**: Pass your payload type (without Document wrapper) to createSchema.
 * The function automatically wraps it with `Document<T>` which adds _id, createdAt, updatedAt.
 *
 * @example
 * ```typescript
 * import { createSchema, type Document } from 'stratadb';
 *
 * // Define your payload type (no _id needed!)
 * type UserPayload = {
 *   name: string;
 *   email: string;
 *   age: number;
 *   status: 'active' | 'inactive';
 * };
 *
 * // The full document type includes _id automatically
 * type User = Document<UserPayload>;
 *
 * // ✅ Create schema using payload type
 * const userSchema = createSchema<UserPayload>()
 *   .field('name', { type: 'TEXT', indexed: true })
 *   .field('email', { type: 'TEXT', indexed: true, unique: true })
 *   .field('age', { type: 'INTEGER', indexed: true })
 *   .field('status', { type: 'TEXT', indexed: true })
 *   .compoundIndex('age_status', ['age', 'status'])
 *   .timestamps(true)
 *   .build();
 *
 * // ✅ Use with database (User type has _id automatically)
 * const users = db.collection<User>('users', userSchema);
 * ```
 */
export function createSchema<
  T extends Record<string, unknown> = Record<string, unknown>,
>(): SchemaBuilder<Document<T>> {
  return new SchemaBuilderImpl<Document<T>>()
}
