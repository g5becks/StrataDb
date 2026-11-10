import type { CollectionAdminContract } from "./collection-contract-admin.js"
import type { CollectionBatchContract } from "./collection-contract-batch.js"
import type { CollectionEventsContract } from "./collection-contract-events.js"
import type { CollectionReadContract } from "./collection-contract-read.js"
import type { CollectionWriteContract } from "./collection-contract-write.js"
import type { Document } from "./core-types.js"

/**
 * Result of inserting a single document into a collection.
 *
 * @typeParam T - The document type
 *
 * @remarks
 * Represents the inserted document with its generated ID.
 * Since SQLite is ACID and local, if this function returns without throwing,
 * the operation succeeded - no acknowledgment flag needed.
 *
 * @example
 * ```typescript
 * const result = await users.insertOne({ name: 'Alice', email: 'alice@example.com' });
 * console.log(result._id); // Auto-generated UUID
 * ```
 */
export type InsertOneResult<T extends Document> = T

/**
 * Result of inserting multiple documents into a collection.
 *
 * @typeParam T - The document type
 *
 * @remarks
 * Contains all successfully inserted documents with their generated IDs and count.
 * Since SQLite is ACID and local, if this function returns without throwing,
 * all inserts succeeded.
 *
 * @example
 * ```typescript
 * const result = await users.insertMany([
 *   { name: 'Alice', email: 'alice@example.com' },
 *   { name: 'Bob', email: 'bob@example.com' }
 * ]);
 * console.log(`Inserted ${result.insertedCount} users`);
 * console.log('User IDs:', result.documents.map(d => d._id));
 * ```
 */
export type InsertManyResult<T extends Document> = {
  /** Array of inserted documents with their generated IDs */
  readonly documents: readonly T[]

  /** Number of documents successfully inserted */
  readonly insertedCount: number
}

/**
 * Result of an update operation.
 *
 * @remarks
 * Provides statistics about documents matched and modified by the update.
 * Since SQLite is ACID and local, if this function returns without throwing,
 * the operation succeeded.
 *
 * @example
 * ```typescript
 * const result = await users.updateMany(
 *   { status: 'inactive' },
 *   { $set: { status: 'deleted' } }
 * );
 * console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
 * ```
 */
export type UpdateResult = {
  /** Number of documents that matched the filter */
  readonly matchedCount: number

  /** Number of documents that were actually modified */
  readonly modifiedCount: number
}

/**
 * Result of a delete operation.
 *
 * @remarks
 * Provides the count of documents deleted by the operation.
 * Since SQLite is ACID and local, if this function returns without throwing,
 * the operation succeeded.
 *
 * @example
 * ```typescript
 * const result = await users.deleteMany({ status: 'inactive' });
 * console.log(`Deleted ${result.deletedCount} users`);
 * ```
 */
export type DeleteResult = {
  /** Number of documents deleted */
  readonly deletedCount: number
}

/**
 * MongoDB-like collection interface for type-safe document operations.
 *
 * @typeParam T - The document type, must extend Document
 *
 * @remarks
 * Collection provides a complete CRUD API with full type safety. It wraps a SQLite
 * table and provides MongoDB-like methods for querying and manipulating documents.
 *
 * **Key Features:**
 * - Type-safe query filters with auto-completion
 * - Generated columns for indexed fields (optimized queries)
 * - JSONB storage for flexible document structure
 * - Built-in validation using Standard Schema validators
 * - Batch operations for performance
 * - Transaction support through database instance
 *
 * **Document Storage:**
 * - All documents stored in a single `data` JSONB column
 * - Indexed fields have generated columns with underscore prefix (e.g., `_age`)
 * - Auto-generated `_id` and `createdAt` fields
 * - Optional `updatedAt` tracking
 *
 * **Comparison to MongoDB:**
 * - Similar API surface for easy migration
 * - Uses SQLite instead of MongoDB protocol
 * - Type-safe at compile time (MongoDB client isn't)
 * - Generated columns optimize common queries
 * - Standard Schema validation (not MongoDB JSON Schema)
 *
 * @example
 * ```typescript
 * import { StrataDB, createSchema, type Document } from 'stratadb';
 * import { z } from 'zod';
 *
 * // Define document type
 * type User = Document<{
 *   name: string;
 *   email: string;
 *   age: number;
 *   role: 'admin' | 'user';
 * }>;
 *
 * // Create schema with validation
 * const userSchema = createSchema<User>()
 *   .field('name', { type: 'TEXT', indexed: true })
 *   .field('email', { type: 'TEXT', indexed: true, unique: true })
 *   .field('age', { type: 'INTEGER', indexed: true })
 *   .field('role', { type: 'TEXT', indexed: false })
 *   .validator(z.object({
 *     name: z.string().min(1),
 *     email: z.string().email(),
 *     age: z.number().int().min(0),
 *     role: z.enum(['admin', 'user'])
 *   }))
 *   .build();
 *
 * // Open database and get collection
 * const db = new StrataDB('myapp.db');
 * const users = db.collection('users', userSchema);
 *
 * // Insert documents
 * const result = await users.insertOne({
 *   name: 'Alice',
 *   email: 'alice@example.com',
 *   age: 30,
 *   role: 'admin'
 * });
 * console.log(result._id); // Auto-generated UUID
 *
 * // Query documents
 * const admins = await users.find({ role: 'admin' });
 * const adults = await users.find({ age: { $gte: 18 } });
 * const alice = await users.findOne({ email: 'alice@example.com' });
 *
 * // Update documents
 * await users.updateOne(
 *   { email: 'alice@example.com' },
 *   { $set: { role: 'user' } }
 * );
 *
 * // Delete documents
 * await users.deleteMany({ age: { $lt: 18 } });
 * ```
 */
export type Collection<T extends Document> = CollectionReadContract<T> &
  CollectionWriteContract<T> &
  CollectionBatchContract<T> &
  CollectionEventsContract<T> &
  CollectionAdminContract<T>
