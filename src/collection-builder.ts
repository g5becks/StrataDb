import type { Database as SQLiteDatabase } from "bun:sqlite"
import type { Collection } from "./collection-types.js"
import type { Document } from "./core-types.js"
import type { JsonPath, SchemaFieldName } from "./path-types.js"
import type { FieldDefinitionOptions } from "./schema-builder-types.js"
import type {
  CompoundIndex,
  SchemaDefinition,
  SchemaField,
  SQLiteType,
  TypeScriptToSQLite,
} from "./schema-types.js"
import { SQLiteCollection } from "./sqlite-collection.js"

/**
 * Fluent builder for creating collections with inline schema definition.
 *
 * @typeParam T - The document type extending Document
 *
 * @remarks
 * CollectionBuilder provides a fluent API for defining collection schemas inline
 * while creating the collection. This is an alternative to using createSchema()
 * separately.
 *
 * @example
 * ```typescript
 * // Fluent collection creation
 * const users = db.collection<User>('users')
 *   .field('name', { type: 'TEXT', indexed: true })
 *   .field('email', { type: 'TEXT', indexed: true, unique: true })
 *   .timestamps(true)
 *   .build();
 * ```
 */
export type CollectionBuilder<T extends Document> = {
  /**
   * Define an indexed field with type checking.
   */
  field<K extends SchemaFieldName<T>>(
    name: K,
    options: {
      readonly path?: JsonPath
      readonly type: K extends keyof T ? TypeScriptToSQLite<T[K]> : SQLiteType
      readonly nullable?: boolean
      readonly indexed?: boolean
      readonly unique?: boolean
      readonly default?: K extends keyof T ? T[K] : unknown
    }
  ): CollectionBuilder<T>

  /** Declare dynamic names with runtime identifier validation on build. */
  fieldUnchecked(
    name: string,
    options: FieldDefinitionOptions
  ): CollectionBuilder<T>

  /**
   * Define a compound index spanning multiple fields.
   */
  compoundIndex(
    name: string,
    fields: readonly SchemaFieldName<T>[],
    options?: { readonly unique?: boolean }
  ): CollectionBuilder<T>

  /** Explicit escape hatch for dynamic compound-index field names. */
  compoundIndexUnchecked(
    name: string,
    fields: readonly string[],
    options?: { readonly unique?: boolean }
  ): CollectionBuilder<T>

  /**
   * Enable automatic timestamp management.
   */
  timestamps(enabled?: boolean): CollectionBuilder<T>

  /**
   * Add validation function using a type predicate.
   */
  validate(validator: (doc: unknown) => doc is T): CollectionBuilder<T>

  /**
   * Enable or disable query caching for this collection.
   *
   * @param enabled - Whether to enable query caching
   * @returns The builder for method chaining
   *
   * @remarks
   * Query caching stores SQL templates for repeated queries, improving performance
   * at the cost of memory usage (up to 500 cached query templates).
   *
   * @example
   * ```typescript
   * // Enable caching for this collection
   * const users = db.collection<User>('users')
   *   .field('name', { type: 'TEXT', indexed: true })
   *   .cache(true)
   *   .build();
   * ```
   */
  cache(enabled: boolean): CollectionBuilder<T>

  /**
   * Build and return the collection with the defined schema.
   *
   * @returns The collection instance ready for operations
   */
  build(): Collection<T>
}

/**
 * Implementation of CollectionBuilder.
 * @internal
 */
export class CollectionBuilderImpl<T extends Document>
  implements CollectionBuilder<T>
{
  private readonly db: SQLiteDatabase
  private readonly collectionName: string
  private readonly idGenerator: () => string
  private readonly fieldDefs: SchemaField<T, keyof T>[] = []
  private readonly compoundIndexDefs: CompoundIndex<T>[] = []
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: used in timestamps() and build()
  private enableTimestamps = false
  private validatorFn: ((doc: unknown) => doc is T) | undefined
  private enableCacheOption: boolean

  constructor(
    db: SQLiteDatabase,
    collectionName: string,
    idGenerator: () => string,
    defaultEnableCache: boolean
  ) {
    this.db = db
    this.collectionName = collectionName
    this.idGenerator = idGenerator
    this.enableCacheOption = defaultEnableCache
  }

  field<K extends SchemaFieldName<T>>(
    name: K,
    options: {
      readonly path?: JsonPath
      readonly type: K extends keyof T ? TypeScriptToSQLite<T[K]> : SQLiteType
      readonly nullable?: boolean
      readonly indexed?: boolean
      readonly unique?: boolean
      readonly default?: K extends keyof T ? T[K] : unknown
    }
  ): CollectionBuilder<T> {
    return this.fieldUnchecked(name, options)
  }

  fieldUnchecked(
    name: string,
    options: FieldDefinitionOptions
  ): CollectionBuilder<T> {
    // Build field object, only adding defined properties
    const field = {
      name,
      type: options.type as TypeScriptToSQLite<T[keyof T]>,
    } as SchemaField<T, keyof T>

    if (options.path !== undefined) {
      ;(field as { path?: JsonPath }).path = options.path
    }
    if (options.nullable !== undefined) {
      ;(field as { nullable?: boolean }).nullable = options.nullable
    }
    if (options.indexed !== undefined) {
      ;(field as { indexed?: boolean }).indexed = options.indexed
    }
    if (options.unique !== undefined) {
      ;(field as { unique?: boolean }).unique = options.unique
    }
    if (options.default !== undefined) {
      ;(field as { default?: T[keyof T] }).default =
        options.default as T[keyof T]
    }

    this.fieldDefs.push(field)
    return this
  }

  compoundIndex(
    name: string,
    fields: readonly SchemaFieldName<T>[],
    options?: { readonly unique?: boolean }
  ): CollectionBuilder<T> {
    return this.compoundIndexUnchecked(name, fields, options)
  }

  compoundIndexUnchecked(
    name: string,
    fields: readonly string[],
    options?: { readonly unique?: boolean }
  ): CollectionBuilder<T> {
    const index = { name, fields } as CompoundIndex<T>
    if (options?.unique !== undefined) {
      ;(index as { unique?: boolean }).unique = options.unique
    }
    this.compoundIndexDefs.push(index)
    return this
  }

  timestamps(enabled = true): CollectionBuilder<T> {
    this.enableTimestamps = enabled
    return this
  }

  validate(validator: (doc: unknown) => doc is T): CollectionBuilder<T> {
    this.validatorFn = validator
    return this
  }

  cache(enabled: boolean): CollectionBuilder<T> {
    this.enableCacheOption = enabled
    return this
  }

  build(): Collection<T> {
    const schema = {
      fields: this.fieldDefs,
      timestamps: this.enableTimestamps,
    } as SchemaDefinition<T>

    if (this.compoundIndexDefs.length > 0) {
      ;(
        schema as { compoundIndexes?: readonly CompoundIndex<T>[] }
      ).compoundIndexes = this.compoundIndexDefs
    }
    if (this.validatorFn !== undefined) {
      ;(schema as { validate?: (doc: unknown) => doc is T }).validate =
        this.validatorFn
    }

    return new SQLiteCollection<T>(
      this.db,
      this.collectionName,
      schema,
      this.idGenerator,
      this.enableCacheOption,
      undefined,
      undefined
    )
  }
}
