import type {
  Except,
  PartialDeep,
  ReadonlyDeep,
  SetOptional,
  Simplify,
} from "type-fest"
import type { PathValue, SchemaFieldName } from "./path-types.js"

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
  readonly _id: string
} & ReadonlyDeep<T>

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
  SetOptional<Except<T, "_id">, never> & { _id?: string }
>

type UpdatePath<T> = SchemaFieldName<Omit<T, "_id" | "createdAt" | "updatedAt">>
type ArrayValue<T> = NonNullable<T> extends readonly (infer Element)[]
  ? Element
  : never

/** Atomic operators over mutable document paths. Operator and merge forms cannot mix. */
export type AtomicUpdate<T extends Document> = {
  readonly $set?: { readonly [Path in UpdatePath<T>]?: PathValue<T, Path> }
  readonly $unset?: { readonly [Path in UpdatePath<T>]?: true | 1 | "" }
  readonly $inc?: {
    readonly [Path in UpdatePath<T> as NonNullable<
      PathValue<T, Path>
    > extends number
      ? Path
      : never]?: number
  }
  readonly $push?: {
    readonly [Path in UpdatePath<T> as ArrayValue<
      PathValue<T, Path>
    > extends never
      ? never
      : Path]?: ArrayValue<PathValue<T, Path>>
  }
  readonly $pull?: {
    readonly [Path in UpdatePath<T> as ArrayValue<
      PathValue<T, Path>
    > extends never
      ? never
      : Path]?: ArrayValue<PathValue<T, Path>>
  }
} & { readonly [Key in keyof T]?: never }

/**
 * Document update type for update operations.
 *
 * @typeParam T - The full document type (Document<YourShape>)
 *
 * @remarks
 * Accepts a deep merge or atomic operators. IDs and timestamp metadata are immutable.
 * Used for `updateOne()` and `updateMany()` operations.
 * Atomic operator paths support dotted fields; plain updates deep-merge objects.
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
export type DocumentUpdate<T extends Document> =
  | (Simplify<PartialDeep<Except<T, "_id" | "createdAt" | "updatedAt">>> & {
      readonly $set?: never
      readonly $unset?: never
      readonly $inc?: never
      readonly $push?: never
      readonly $pull?: never
    })
  | AtomicUpdate<T>

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
export type BulkWriteResult<T extends Document> = {
  /** Number of documents successfully inserted */
  readonly insertedCount: number

  /** Array of generated IDs for successfully inserted documents */
  readonly insertedIds: readonly string[]

  /** Array of successfully inserted documents with IDs */
  readonly documents: readonly T[]

  /** Array of errors for failed insertions */
  readonly errors: readonly {
    /** Index of the failed document in the input array */
    readonly index: number

    /** Error that caused the insertion to fail */
    readonly error: Error

    /** Original document input that failed */
    readonly document: DocumentInput<T>
  }[]
}
