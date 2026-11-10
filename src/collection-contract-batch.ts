import type {
  DeleteResult,
  InsertManyResult,
  UpdateResult,
} from "./collection-types.js"
import type { Document, DocumentUpdate } from "./core-types.js"
import type { QueryFilter } from "./query-types.js"
import type { RetryOptions } from "./retry-types.js"
/** Batch members of {@link Collection}. */
export type CollectionBatchContract<T extends Document> = {
  // ===== Batch Write Operations =====

  /**
   * Insert multiple documents into the collection.
   *
   * @param docs - Array of documents to insert
   * @returns Promise resolving to insert result with all new documents
   *
   * @remarks
   * Inserts all documents in a single transaction for performance.
   * If any document fails validation, the entire operation rolls back.
   * Automatically generates `id`, `createdAt`, and `updatedAt` for each document.
   *
   * **Performance:**
   * Much faster than multiple `insertOne` calls since it uses a single transaction.
   *
   * @throws {ValidationError} If any document fails schema validation
   * @throws {ConstraintError} If any unique constraint is violated
   *
   * @example
   * ```typescript
   * const result = await users.insertMany([
   *   { name: 'Alice', email: 'alice@example.com', age: 30, role: 'admin' },
   *   { name: 'Bob', email: 'bob@example.com', age: 25, role: 'user' },
   *   { name: 'Charlie', email: 'charlie@example.com', age: 35, role: 'user' }
   * ]);
   * console.log(`Inserted ${result.insertedCount} users`);
   *
   * // With abort signal
   * const controller = new AbortController();
   * const result = await users.insertMany(docs, { signal: controller.signal });
   * ```
   */
  insertMany(
    docs: readonly Omit<T, "_id" | "createdAt" | "updatedAt">[],
    options?: {
      ordered?: boolean
      signal?: AbortSignal
      retry?: RetryOptions | false
    }
  ): Promise<InsertManyResult<T>>

  /**
   * Update multiple documents matching the query filter.
   *
   * @param filter - Query filter to find documents to update
   * @param update - Update operations to apply
   * @returns Promise resolving to update result with statistics
   *
   * @remarks
   * Updates all documents that match the filter.
   * Uses MongoDB-style update operators.
   * Automatically updates `updatedAt` for each modified document.
   *
   * @example
   * ```typescript
   * // Set all inactive users to deleted status
   * const result = await users.updateMany(
   *   { status: 'inactive' },
   *   { $set: { status: 'deleted' } }
   * );
   * console.log(`Updated ${result.modifiedCount} users`);
   *
   * // Give all admins a badge
   * await users.updateMany(
   *   { role: 'admin' },
   *   { $set: { badge: 'admin' } }
   * );
   *
   * // With abort signal
   * const controller = new AbortController();
   * const result = await users.updateMany(filter, update, { signal: controller.signal });
   * ```
   */
  updateMany(
    filter: QueryFilter<T>,
    update: DocumentUpdate<T>,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<UpdateResult>

  /**
   * Delete multiple documents matching the query filter.
   *
   * @param filter - Query filter to find documents to delete
   * @returns Promise resolving to delete result with statistics
   *
   * @remarks
   * Deletes all documents that match the filter.
   * Use an empty filter `{}` to delete all documents in the collection.
   *
   * **Warning:**
   * This operation cannot be undone. Consider backing up data before
   * bulk delete operations.
   *
   * @example
   * ```typescript
   * // Delete all inactive users
   * const result = await users.deleteMany({ status: 'inactive' });
   * console.log(`Deleted ${result.deletedCount} users`);
   *
   * // Delete all documents (use with caution!)
   * await users.deleteMany({});
   *
   * // With abort signal
   * const controller = new AbortController();
   * const result = await users.deleteMany(filter, { signal: controller.signal });
   * ```
   */
  deleteMany(
    filter: QueryFilter<T>,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<DeleteResult>
}
