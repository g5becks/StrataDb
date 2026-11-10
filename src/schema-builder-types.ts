import type { Document } from "./core-types.js"
import type { JsonPath, SchemaFieldName } from "./path-types.js"
import type { SchemaDefinition } from "./schema-types.js"

/** Field configuration used by explicit dynamic-name escape hatches. */
export type FieldDefinitionOptions = {
  readonly path?: JsonPath
  readonly type: string
  readonly nullable?: boolean
  readonly indexed?: boolean
  readonly unique?: boolean
  readonly default?: unknown
}

/**
 * Fluent builder interface for defining collection schemas.
 *
 * @typeParam T - The document type extending Document
 *
 * @remarks
 * Provides a chainable API for defining fields, indexes, timestamps, and validation.
 * Each method returns `this` to enable method chaining, creating an excellent
 * developer experience with full IntelliSense support.
 *
 * Use the `createSchema<T>()` helper function to create a schema builder instance.
 * The builder pattern ensures schemas are constructed in a type-safe manner,
 * catching configuration errors at compile time.
 *
 * @example
 * ```typescript
 * import { createSchema, type Document } from 'stratadb';
 *
 * type User = Document<{
 *   name: string;
 *   email: string;
 *   age: number;
 *   status: 'active' | 'inactive';
 * }>;
 *
 * // ✅ Build schema with fluent API
 * const userSchema = createSchema<User>()
 *   .field('name', { type: 'TEXT', indexed: true })
 *   .field('email', { type: 'TEXT', indexed: true, unique: true })
 *   .field('age', { type: 'INTEGER', indexed: true })
 *   .field('status', { type: 'TEXT', indexed: true })
 *   .compoundIndex('age_status', ['age', 'status'])
 *   .timestamps(true)
 *   .validate((doc): doc is User => {
 *     return typeof doc === 'object' &&
 *            doc !== null &&
 *            'name' in doc &&
 *            typeof doc.name === 'string';
 *   })
 *   .build();
 *
 * // Use with database collection
 * const users = db.collection<User>('users', userSchema);
 * ```
 */
export type SchemaBuilder<T extends Document> = {
  /**
   * Define an indexed field with type checking.
   *
   * @param name - The field name (supports dot notation for nested fields like 'profile.bio' or 'watchlistItem.ticker')
   * @param options - Field configuration options
   * @returns This builder instance for method chaining
   *
   * @remarks
   * Field names support dot notation for accessing nested properties.
   * When a dot is detected in the name, it automatically becomes the JSON path.
   *
   * For top-level fields, the path defaults to `$.{name}`.
   * For nested fields like 'profile.bio', the path becomes '$.profile.bio'.
   * For deeply nested fields, any nesting depth is supported.
   *
   * @example
   * ```typescript
   * // ✅ Top-level fields
   * .field('name', { type: 'TEXT', indexed: true })
   * .field('email', { type: 'TEXT', indexed: true, unique: true })
   *
   * // ✅ Nested fields with dot notation
   * .field('profile.bio', { type: 'TEXT', indexed: true })
   * .field('watchlistItem.ticker', { type: 'TEXT', indexed: true })
   * .field('user.settings.theme', { type: 'TEXT', indexed: true })
   *
   * // ✅ Field with default value
   * .field('status', {
   *   type: 'TEXT',
   *   indexed: true,
   *   default: 'active'
   * })
   * ```
   */
  field<K extends SchemaFieldName<T>>(
    name: K,
    options: {
      /** JSON path (defaults to $.{name} if omitted, or auto-generated from dot notation) */
      readonly path?: JsonPath
      /** SQLite column type */
      readonly type: string
      /** Whether field can be null */
      readonly nullable?: boolean
      /** Create index for faster queries */
      readonly indexed?: boolean
      /** Enforce uniqueness constraint */
      readonly unique?: boolean
      /** Default value when not provided */
      readonly default?: unknown
    }
  ): SchemaBuilder<T>

  /** Declare a dynamic field name; runtime identifier validation still applies. */
  fieldUnchecked(
    name: string,
    options: FieldDefinitionOptions
  ): SchemaBuilder<T>

  /**
   * Define a compound index spanning multiple fields.
   *
   * @param name - Unique name for the index
   * @param fields - Array of field names (order matters, supports dot notation for nested fields)
   * @param options - Index options (unique constraint)
   * @returns This builder instance for method chaining
   *
   * @remarks
   * Compound indexes improve query performance when filtering by multiple fields together.
   * Field names can use dot notation to reference nested properties.
   * The order of fields matters - queries must use fields from left to right for the
   * index to be effective.
   *
   * @example
   * ```typescript
   * // ✅ Compound index for top-level fields
   * .compoundIndex('age_status', ['age', 'status'])
   *
   * // ✅ Compound index with nested fields
   * .compoundIndex('watchlist_active', ['watchlistItem.ticker', 'isActive'])
   *
   * // ✅ Unique compound constraint
   * .compoundIndex('email_tenant', ['email', 'tenantId'], { unique: true })
   *
   * // Query optimization example:
   * // This index helps with queries like:
   * // - { age: 30, status: 'active' }  ✅ Uses index fully
   * // - { age: { $gte: 25 } }          ✅ Uses index partially (age only)
   * // - { status: 'active' }           ❌ Cannot use index (doesn't start with 'age')
   * ```
   */
  compoundIndex(
    name: string,
    fields: readonly SchemaFieldName<T>[],
    options?: { readonly unique?: boolean }
  ): SchemaBuilder<T>

  /** Declare dynamic compound-index fields with runtime identifier validation. */
  compoundIndexUnchecked(
    name: string,
    fields: readonly string[],
    options?: { readonly unique?: boolean }
  ): SchemaBuilder<T>

  /**
   * Enable automatic timestamp management.
   *
   * @param enabled - Whether to auto-manage createdAt/updatedAt (default: true)
   * @returns This builder instance for method chaining
   *
   * @remarks
   * When enabled, automatically adds `createdAt` timestamp on insert and
   * updates `updatedAt` timestamp on modifications. This is useful for
   * audit trails and tracking document lifecycle.
   *
   * The timestamps are stored as ISO 8601 strings in SQLite and exposed
   * as Date objects in TypeScript.
   *
   * @example
   * ```typescript
   * // ✅ Enable timestamps
   * .timestamps(true)
   *
   * // ✅ Disable timestamps (default if not called)
   * .timestamps(false)
   *
   * // After enabling, your documents will have:
   * interface UserWithTimestamps extends User {
   *   createdAt: Date;
   *   updatedAt: Date;
   * }
   * ```
   */
  timestamps(enabled?: boolean): SchemaBuilder<T>

  /**
   * Add validation function using a type predicate.
   *
   * @param validator - Function that validates and narrows the document type
   * @returns This builder instance for method chaining
   *
   * @remarks
   * The validation function is a type predicate that narrows `unknown` to your
   * document type `T`. This runs at runtime before inserting or updating documents.
   *
   * For Standard Schema validators (Zod, Valibot, ArkType, etc.), this method
   * wraps the validator's validation logic. You can also provide custom validation
   * logic directly.
   *
   * @example
   * ```typescript
   * // ✅ Custom validation function
   * .validate((doc): doc is User => {
   *   return typeof doc === 'object' &&
   *          doc !== null &&
   *          'name' in doc &&
   *          typeof doc.name === 'string' &&
   *          'email' in doc &&
   *          typeof doc.email === 'string' &&
   *          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doc.email);
   * })
   *
   * // ✅ Using with Zod (Standard Schema)
   * import { z } from 'zod';
   *
   * const UserSchema = z.object({
   *   name: z.string().min(1),
   *   email: z.string().email(),
   *   age: z.number().int().min(0)
   * });
   *
   * .validate((doc): doc is User => {
   *   return UserSchema.safeParse(doc).success;
   * })
   * ```
   */
  validate(validator: (doc: unknown) => doc is T): SchemaBuilder<T>

  /**
   * Build and return the complete schema definition.
   *
   * @returns The immutable schema definition
   *
   * @remarks
   * Finalizes the schema construction and returns an immutable `SchemaDefinition<T>`
   * that can be used to create collections. Once built, the schema cannot be modified.
   *
   * This method completes the builder chain and should always be the final call.
   *
   * @example
   * ```typescript
   * // ✅ Build the schema
   * const schema = createSchema<User>()
   *   .field('name', { type: 'TEXT', indexed: true })
   *   .field('email', { type: 'TEXT', indexed: true, unique: true })
   *   .timestamps(true)
   *   .build();
   *
   * // ✅ Use with collection
   * const users = db.collection<User>('users', schema);
   *
   * // ❌ Cannot modify after building
   * // schema.field('age', { type: 'INTEGER' }); // Error: build() returns SchemaDefinition
   * ```
   */
  build(): SchemaDefinition<T>
}

/**
 * Creates a standalone schema builder for defining collection schemas.
 *
 * @typeParam T - The document type extending Document
 * @returns A new schema builder instance
 *
 * @remarks
 * This factory function creates a new `SchemaBuilder<T>` instance that provides
 * a fluent API for constructing schemas. The builder ensures type safety at every
 * step, preventing invalid field types, incorrect index definitions, and other
 * configuration errors at compile time.
 *
 * Schemas can be defined separately from collection creation, making them reusable
 * across multiple database instances or testable in isolation.
 *
 * @example
 * ```typescript
 * import { createSchema, type Document } from 'stratadb';
 *
 * type User = Document<{
 *   name: string;
 *   email: string;
 *   age: number;
 *   status: 'active' | 'inactive';
 * }>;
 *
 * // ✅ Define schema separately
 * const userSchema = createSchema<User>()
 *   .field('name', { type: 'TEXT', indexed: true })
 *   .field('email', { type: 'TEXT', indexed: true, unique: true })
 *   .field('age', { type: 'INTEGER', indexed: true })
 *   .field('status', { type: 'TEXT', indexed: true })
 *   .compoundIndex('age_status', ['age', 'status'])
 *   .timestamps(true)
 *   .validate((doc): doc is User => {
 *     return typeof doc === 'object' && doc !== null && 'name' in doc;
 *   })
 *   .build();
 *
 * // ✅ Use with collection
 * const users = db.collection<User>('users', userSchema);
 *
 * // ✅ Reuse schema across databases
 * const testUsers = testDb.collection<User>('users', userSchema);
 *
 * // ✅ Inline schema definition (alternative)
 * const posts = db.collection<Post>('posts')
 *   .field('title', { type: 'TEXT', indexed: true })
 *   .field('content', { type: 'TEXT' })
 *   .build();
 * ```
 */
export declare function createSchema<T extends Document>(): SchemaBuilder<T>
