import type { Document, DocumentUpdate } from "./core-types.js"
import type { SortSpec } from "./query-options-types.js"
import type { QueryFilter } from "./query-types.js"
import type { RetryOptions } from "./retry-types.js"
/** Write members of {@link Collection}. */
export type CollectionWriteContract<T extends Document> = {
  // ===== Single Write Operations =====

  /**
   * Insert a single document into the collection.
   *
   * @param doc - Document to insert (without _id, createdAt, updatedAt)
   * @returns Promise resolving to the inserted document with generated _id
   *
   * @remarks
   * Validates the document against the schema before inserting.
   * Automatically generates:
   * - `_id`: Configured generator (UUID v7 by default)
   * - `createdAt`: Current timestamp
   * - `updatedAt`: Current timestamp; metadata visibility follows timestamps
   *
   * **Validation:**
   * If validation fails, throws `ValidationError` with details.
   *
   * @throws {ValidationError} If document fails schema validation
   * @throws {ConstraintError} If unique constraint is violated
   *
   * @example
   * ```typescript
   * try {
   *   const user = await users.insertOne({
   *     name: 'Bob',
   *     email: 'bob@example.com',
   *     age: 25,
   *     role: 'user'
   *   });
   *   console.log(`Inserted user with ID: ${user._id}`);
   *   console.log(`User name: ${user.name}`);
   * } catch (err) {
   *   if (err instanceof ValidationError) {
   *     console.error('Invalid user:', err.message);
   *   }
   * }
   *
   * // With abort signal
   * const controller = new AbortController();
   * const user = await users.insertOne(doc, { signal: controller.signal });
   * ```
   */
  insertOne(
    doc: Omit<T, "_id" | "createdAt" | "updatedAt">,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<T>

  /**
   * Update a single document matching the query filter or ID.
   *
   * @param filter - Document ID or query filter to find the document to update
   * @param update - Partial document with fields to update
   * @param options - Optional upsert configuration
   * @returns Promise resolving to the updated document, or null if not found
   *
   * @remarks
   * Updates the first document that matches the filter.
   * Merges the provided partial document with the existing document.
   * Automatically updates `updatedAt` if present in schema.
   *
   * Accepts either a string ID or a full QueryFilter object for flexible targeting:
   * - String ID: `{ _id: string }` filter is applied automatically
   * - QueryFilter: Full MongoDB-style query filtering
   *
   * @example
   * ```typescript
   * // Update by document ID
   * const updated = await users.updateOne(
   *   '123e4567-e89b-12d3-a456-426614174000',
   *   { role: 'admin', verified: true }
   * );
   *
   * // Update by query filter
   * await users.updateOne(
   *   { email: 'alice@example.com' },
   *   { role: 'admin', verified: true }
   * );
   *
   * // Update with upsert
   * await users.updateOne(
   *   { email: 'new@example.com' },
   *   { role: 'user' },
   *   { upsert: true }
   * );
   *
   * // With abort signal
   * const controller = new AbortController();
   * await users.updateOne(filter, update, { signal: controller.signal });
   * ```
   */
  updateOne(
    filter: string | QueryFilter<T>,
    update: DocumentUpdate<T>,
    options?: {
      upsert?: boolean
      signal?: AbortSignal
      retry?: RetryOptions | false
    }
  ): Promise<T | null>

  /**
   * Replace a single document by ID or filter.
   *
   * @param filter - Document ID (string) or query filter
   * @param doc - New document to replace with (without _id, createdAt, updatedAt)
   * @returns Promise resolving to the replaced document, or null if not found
   *
   * @remarks
   * This method accepts either a string ID or a query filter for maximum flexibility.
   * When you have the document ID, pass it directly as a string for convenience.
   * When you need to replace by other fields, pass a filter object.
   *
   * Completely replaces the matched document with the new document.
   * Preserves `_id` and `createdAt`, updates `updatedAt`.
   * Validates the new document against the schema.
   *
   * **Difference from updateOne:**
   * - `updateOne`: Merges specific fields into existing document
   * - `replaceOne`: Replaces entire document (except _id, createdAt)
   *
   * @throws {ValidationError} If new document fails schema validation
   *
   * @example
   * ```typescript
   * // Replace by ID (string)
   * const replaced = await users.replaceOne(
   *   'user-123',
   *   {
   *     name: 'Alice Smith',
   *     email: 'alice.smith@example.com',
   *     age: 31,
   *     role: 'admin'
   *   }
   * );
   *
   * // Replace by filter
   * const replaced = await users.replaceOne(
   *   { email: 'old@example.com' },
   *   {
   *     name: 'Alice Smith',
   *     email: 'new@example.com',
   *     age: 31,
   *     role: 'admin'
   *   }
   * );
   *
   * // With abort signal
   * const controller = new AbortController();
   * const replaced = await users.replaceOne(filter, doc, { signal: controller.signal });
   * ```
   */
  replaceOne(
    filter: string | QueryFilter<T>,
    doc: Omit<T, "_id" | "createdAt" | "updatedAt">,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<T | null>

  /**
   * Delete a single document by ID or filter.
   *
   * @param filter - Document ID (string) or query filter
   * @returns Promise resolving to `true` if document was deleted, `false` if not found
   *
   * @remarks
   * This method accepts either a string ID or a query filter for maximum flexibility.
   * When you have the document ID, pass it directly as a string for convenience.
   * When you need to delete by other fields, pass a filter object.
   *
   * Deletes the first document that matches the filter.
   * If no document matches, returns `false`.
   *
   * @example
   * ```typescript
   * // Delete by ID (string)
   * const deleted = await users.deleteOne('user-123')
   * if (deleted) {
   *   console.log('User deleted successfully')
   * }
   *
   * // Delete by filter
   * const deleted = await users.deleteOne({ email: 'inactive@example.com' })
   *
   * // Delete with complex filter
   * const deleted = await users.deleteOne({
   *   status: 'inactive',
   *   lastLogin: { $lt: Date.now() - 90 * 24 * 60 * 60 * 1000 } // 90 days
   * })
   *
   * // With abort signal
   * const controller = new AbortController();
   * const deleted = await users.deleteOne(filter, { signal: controller.signal });
   * ```
   */
  deleteOne(
    filter: string | QueryFilter<T>,
    options?: {
      signal?: AbortSignal
      retry?: RetryOptions | false
      includeDocument?: boolean
    }
  ): Promise<boolean>

  // ===== Atomic Find-and-Modify Operations =====

  /**
   * Find and delete a single document atomically.
   *
   * @param filter - Document ID (string) or query filter
   * @param options - Query options (sort)
   * @returns Promise resolving to the deleted document, or null if not found
   *
   * @remarks
   * This method accepts either a string ID or a query filter for maximum flexibility.
   * When you have the document ID, pass it directly as a string for convenience.
   * When you need to delete by other fields, pass a filter object.
   *
   * This operation is atomic - it finds and deletes in a single operation.
   * Useful when you need the deleted document's data (e.g., for logging, undo operations).
   *
   * When multiple documents match the filter, the sort option determines which one is deleted.
   *
   * @example
   * ```typescript
   * // Delete by ID
   * const deleted = await users.findOneAndDelete('user-123');
   * if (deleted) {
   *   console.log(`Deleted user: ${deleted.name}`);
   *   await logDeletion(deleted);
   * }
   *
   * // Delete by filter
   * const deleted = await users.findOneAndDelete({ email: 'old@example.com' });
   *
   * // Delete with sort (delete oldest inactive user)
   * const deleted = await users.findOneAndDelete(
   *   { status: 'inactive' },
   *   { sort: { createdAt: 1 } }
   * );
   *
   * // With abort signal
   * const controller = new AbortController();
   * const deleted = await users.findOneAndDelete(filter, { signal: controller.signal });
   * ```
   */
  findOneAndDelete(
    filter: string | QueryFilter<T>,
    options?: {
      sort?: SortSpec<T>
      signal?: AbortSignal
      retry?: RetryOptions | false
    }
  ): Promise<T | null>

  /**
   * Find and update a single document atomically.
   *
   * @param filter - Document ID (string) or query filter
   * @param update - Partial document with fields to update
   * @param options - Update options (sort, returnDocument, upsert)
   * @returns Promise resolving to the document before or after update, or null if not found
   *
   * @remarks
   * This method accepts either a string ID or a query filter for maximum flexibility.
   * When you have the document ID, pass it directly as a string for convenience.
   * When you need to update by other fields, pass a filter object.
   *
   * This operation is atomic - it finds and updates in a single logical operation.
   * Use `returnDocument` to control whether you get the document state before or after the update.
   * Default is 'after'.
   *
   * @example
   * ```typescript
   * // Update by ID
   * const updated = await users.findOneAndUpdate(
   *   'user-123',
   *   { loginCount: 5 },
   *   { returnDocument: 'after' }
   * );
   *
   * // Update by filter
   * const updated = await users.findOneAndUpdate(
   *   { email: 'alice@example.com' },
   *   { loginCount: 5 },
   *   { returnDocument: 'after' }
   * );
   * console.log(`New login count: ${updated?.loginCount}`);
   *
   * // Get previous state before update
   * const before = await users.findOneAndUpdate(
   *   { _id: userId },
   *   { status: 'archived' },
   *   { returnDocument: 'before' }
   * );
   * await logStatusChange(before, 'archived');
   *
   * // Upsert with returnDocument
   * const result = await users.findOneAndUpdate(
   *   { email: 'new@example.com' },
   *   { name: 'New User', age: 25 },
   *   { upsert: true, returnDocument: 'after' }
   * );
   *
   * // With abort signal
   * const controller = new AbortController();
   * const updated = await users.findOneAndUpdate(filter, update, { signal: controller.signal });
   * ```
   */
  findOneAndUpdate(
    filter: string | QueryFilter<T>,
    update: DocumentUpdate<T>,
    options?: {
      sort?: SortSpec<T>
      returnDocument?: "before" | "after"
      upsert?: boolean
      signal?: AbortSignal
      retry?: RetryOptions | false
    }
  ): Promise<T | null>

  /**
   * Find and replace a single document atomically.
   *
   * @param filter - Document ID (string) or query filter
   * @param replacement - Complete replacement document (without _id, createdAt, updatedAt)
   * @param options - Replace options (sort, returnDocument, upsert)
   * @returns Promise resolving to the document before or after replacement, or null if not found
   *
   * @remarks
   * This method accepts either a string ID or a query filter for maximum flexibility.
   * When you have the document ID, pass it directly as a string for convenience.
   * When you need to replace by other fields, pass a filter object.
   *
   * This operation replaces the ENTIRE document (except _id, createdAt).
   * Unlike `findOneAndUpdate` which merges fields, this replaces everything.
   * The replacement document is validated against the schema.
   * Default returnDocument is 'after'.
   *
   * @example
   * ```typescript
   * // Replace by ID
   * const replaced = await users.findOneAndReplace(
   *   'user-123',
   *   {
   *     name: 'New Name',
   *     email: 'new@example.com',
   *     age: 30,
   *     active: true,
   *     tags: []
   *   },
   *   { returnDocument: 'after' }
   * );
   *
   * // Replace by filter
   * const replaced = await users.findOneAndReplace(
   *   { email: 'old@example.com' },
   *   {
   *     name: 'New Name',
   *     email: 'new@example.com',
   *     age: 30,
   *     active: true,
   *     tags: []
   *   }
   * );
   *
   * // With abort signal
   * const controller = new AbortController();
   * const replaced = await users.findOneAndReplace(filter, replacement, { signal: controller.signal });
   * ```
   */
  findOneAndReplace(
    filter: string | QueryFilter<T>,
    replacement: Omit<T, "_id" | "createdAt" | "updatedAt">,
    options?: {
      sort?: SortSpec<T>
      returnDocument?: "before" | "after"
      upsert?: boolean
      signal?: AbortSignal
      retry?: RetryOptions | false
    }
  ): Promise<T | null>
}
