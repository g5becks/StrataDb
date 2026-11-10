import type {
  CollectionEventMap,
  CollectionEventName,
} from "./collection-events.js"
import type { Document, DocumentUpdate } from "./core-types.js"
import type {
  QueryOptions,
  QueryOptionsWithOmit,
  QueryOptionsWithSelect,
  SortSpec,
} from "./query-options-types.js"
import type { QueryFilter } from "./query-types.js"
import type { RetryOptions } from "./retry-types.js"
import type { SchemaDefinition } from "./schema-types.js"

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
export type Collection<T extends Document> = {
  /**
   * Collection name (table name in SQLite).
   */
  readonly name: string

  /**
   * Schema definition for this collection.
   */
  readonly schema: SchemaDefinition<T>

  // ===== Read Operations =====

  /**
   * Find a single document by its ID.
   *
   * @param id - The document ID to search for
   * @param options - Optional options including signal for cancellation
   * @returns Promise resolving to the document, or null if not found
   *
   * @remarks
   * This is the fastest way to retrieve a specific document since it uses
   * the primary key index.
   *
   * @example
   * ```typescript
   * const user = await users.findById('123e4567-e89b-12d3-a456-426614174000');
   * if (user) {
   *   console.log(user.name);
   * }
   *
   * // With abort signal
   * const controller = new AbortController();
   * const user = await users.findById(id, { signal: controller.signal });
   * ```
   */
  findById(
    id: string,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<T | null>

  /**
   * Find all documents matching the query filter.
   *
   * @param filter - Query filter to match documents
   * @param options - Query options for sorting, pagination, and projection
   * @returns Promise resolving to array of matching documents
   *
   * @remarks
   * Returns all documents that match the filter. For large result sets,
   * use `limit` and `skip` options for pagination.
   *
   * **Performance:**
   * - Indexed fields use generated columns (fast)
   * - Non-indexed fields use jsonb_extract (slower)
   * - Consider adding indexes for frequently queried fields
   *
   * @example
   * ```typescript
   * // Find all active admins
   * const admins = await users.find({
   *   role: 'admin',
   *   status: 'active'
   * });
   *
   * // Find with sorting and pagination
   * const page = await users.find(
   *   { age: { $gte: 18 } },
   *   { sort: { createdAt: -1 }, limit: 20, skip: 40 }
   * );
   *
   * // Find with complex query
   * const results = await users.find({
   *   $and: [
   *     { age: { $gte: 18, $lt: 65 } },
   *     {
   *       $or: [
   *         { role: 'admin' },
   *         { verified: true }
   *       ]
   *     }
   *   ]
   * });
   * ```
   */
  // Overload 1: With select - returns Pick<T, K | '_id'>
  find<K extends keyof T>(
    filter: QueryFilter<T>,
    options: QueryOptionsWithSelect<T, K>
  ): Promise<readonly Pick<T, K | (keyof T & "_id")>[]>

  // Overload 2: With omit - returns Omit<T, K>
  find<K extends keyof T>(
    filter: QueryFilter<T>,
    options: QueryOptionsWithOmit<T, K>
  ): Promise<readonly Omit<T, K>[]>

  // Overload 3: No projection or general options - returns T
  find(filter: QueryFilter<T>, options?: QueryOptions<T>): Promise<readonly T[]>

  /**
   * Find the first document matching the query filter or ID.
   *
   * @param filter - Document ID or query filter to match documents
   * @param options - Query options for sorting and projection
   * @returns Promise resolving to the first matching document, or null if none found
   *
   * @remarks
   * Equivalent to `find(filter, { ...options, limit: 1 })[0]` but more efficient
   * since it stops after finding the first match.
   *
   * Accepts either a string ID or a full QueryFilter object for flexible querying:
   * - String ID: `{ _id: string }` filter is applied automatically
   * - QueryFilter: Full MongoDB-style query filtering
   *
   * @example
   * ```typescript
   * // Find by document ID
   * const user = await users.findOne('123e4567-e89b-12d3-a456-426614174000');
   * if (user) {
   *   console.log(user.name);
   * }
   *
   * // Find by query filter
   * const admin = await users.findOne({ role: 'admin' });
   *
   * // Find with options
   * const latest = await users.findOne(
   *   {},
   *   { sort: { createdAt: -1 } }
   * );
   *
   * // Check if email exists
   * const exists = await users.findOne({ email: 'alice@example.com' });
   * if (exists) {
   *   console.log('Email already registered');
   * }
   * ```
   */
  // Overload 1: With select - returns Pick<T, K | '_id'>
  findOne<K extends keyof T>(
    filter: string | QueryFilter<T>,
    options: Omit<QueryOptionsWithSelect<T, K>, "limit" | "skip">
  ): Promise<Pick<T, K | (keyof T & "_id")> | null>

  // Overload 2: With omit - returns Omit<T, K>
  findOne<K extends keyof T>(
    filter: string | QueryFilter<T>,
    options: Omit<QueryOptionsWithOmit<T, K>, "limit" | "skip">
  ): Promise<Omit<T, K> | null>

  // Overload 3: No projection or general options - returns T
  findOne(
    filter: string | QueryFilter<T>,
    options?: Omit<QueryOptions<T>, "limit" | "skip">
  ): Promise<T | null>

  /**
   * Count documents matching the query filter.
   *
   * @param filter - Query filter to match documents
   * @param options - Optional options including signal for cancellation
   * @returns Promise resolving to the count of matching documents
   *
   * @remarks
   * More efficient than `find(filter).length` since it only counts without
   * retrieving document data.
   *
   * @example
   * ```typescript
   * // Count all users
   * const total = await users.count({});
   *
   * // Count active admins
   * const adminCount = await users.count({
   *   role: 'admin',
   *   status: 'active'
   * });
   *
   * // Count adults
   * const adultCount = await users.count({ age: { $gte: 18 } });
   *
   * // With abort signal
   * const controller = new AbortController();
   * const count = await users.count({}, { signal: controller.signal });
   * ```
   */
  count(
    filter: QueryFilter<T>,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<number>

  /**
   * Search for documents across multiple fields.
   *
   * @param text - The search text to find
   * @param fields - Array of field names to search within
   * @param options - Optional query options (filter, sort, limit, projection, etc.)
   * @returns Promise resolving to array of matching documents
   *
   * @remarks
   * Performs case-insensitive text search across the specified fields using
   * SQL LIKE patterns. A document matches if the search text appears in ANY
   * of the specified fields.
   *
   * **Search behavior:**
   * - Case-insensitive by default
   * - Matches partial strings (e.g., "script" matches "TypeScript")
   * - Uses OR logic across fields (match in any field returns the document)
   *
   * **Performance:**
   * - Indexed fields use generated columns for faster matching
   * - Non-indexed fields use JSON extraction (slower for large datasets)
   * - Consider indexing frequently searched fields
   *
   * **Comparison to find() with search option:**
   * - `search()` is cleaner when text search is the primary operation
   * - `find()` with `search` option is better when combining with complex filters
   *
   * @example
   * ```typescript
   * // Search for "typescript" in title and content
   * const articles = await posts.search('typescript', ['title', 'content']);
   *
   * // Search with additional filtering
   * const results = await posts.search('react', ['title', 'content'], {
   *   filter: { category: 'programming' },
   *   sort: { createdAt: -1 },
   *   limit: 10
   * });
   *
   * // Search in nested fields
   * const docs = await articles.search('hooks', ['title', 'metadata.keywords']);
   *
   * // Search with projection
   * const titles = await posts.search('javascript', ['title', 'content'], {
   *   select: ['title', 'author']
   * });
   *
   * // Case-sensitive search
   * const exact = await posts.search('TypeScript', ['title'], {
   *   caseSensitive: true
   * });
   * ```
   */
  // Overload 1: With select - returns Pick<T, K | '_id'>
  search<K extends keyof T>(
    text: string,
    fields: readonly (keyof T | string)[],
    options: Omit<QueryOptionsWithSelect<T, K>, "search"> & {
      filter?: QueryFilter<T>
      caseSensitive?: boolean
    }
  ): Promise<readonly Pick<T, K | (keyof T & "_id")>[]>

  // Overload 2: With omit - returns Omit<T, K>
  search<K extends keyof T>(
    text: string,
    fields: readonly (keyof T | string)[],
    options: Omit<QueryOptionsWithOmit<T, K>, "search"> & {
      filter?: QueryFilter<T>
      caseSensitive?: boolean
    }
  ): Promise<readonly Omit<T, K>[]>

  // Overload 3: No projection or general options - returns T
  search(
    text: string,
    fields: readonly (keyof T | string)[],
    options?: Omit<QueryOptions<T>, "search"> & {
      filter?: QueryFilter<T>
      caseSensitive?: boolean
    }
  ): Promise<readonly T[]>

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
   * - `_id`: UUID v4
   * - `createdAt`: Current timestamp
   * - `updatedAt`: Current timestamp (if schema has this field)
   *
   * **Validation:**
   * If validation fails, throws `ValidationError` with details.
   *
  /**
   * Insert a single document into the collection.
   *
   * @param doc - Document to insert (without _id, createdAt, updatedAt)
   * @returns Promise resolving to the inserted document with generated _id
   *
   * @remarks
   * Validates the document against the schema before inserting.
   * Automatically generates:
   * - `_id`: UUID v4
   * - `createdAt`: Current timestamp
   * - `updatedAt`: Current timestamp (if schema has this field)
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

  // ===== Utility Methods =====

  /**
   * Find distinct values for a specified field across the collection.
   *
   * @param field - The field name to get distinct values for
   * @param filter - Optional query filter to narrow results
   * @param options - Optional options including signal for cancellation
   * @returns Promise resolving to array of unique values for the field
   *
   * @remarks
   * Returns an array of unique values for the specified field.
   * If a filter is provided, only documents matching the filter are considered.
   *
   * The method uses SQLite's DISTINCT clause for efficient querying.
   * For indexed fields, uses the generated column; for non-indexed fields, uses JSON extraction.
   *
   * @example
   * ```typescript
   * // Get all unique ages
   * const ages = await users.distinct('age');
   * console.log(ages); // [25, 30, 35, 40]
   *
   * // Get unique roles for active users
   * const activeRoles = await users.distinct('role', { active: true });
   *
   * // Get unique tags (array field)
   * const tags = await users.distinct('tags');
   *
   * // With abort signal
   * const controller = new AbortController();
   * const ages = await users.distinct('age', {}, { signal: controller.signal });
   * ```
   */
  distinct<K extends keyof Omit<T, "_id" | "createdAt" | "updatedAt">>(
    field: K,
    filter?: QueryFilter<T>,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<T[K][]>

  /**
   * Get an estimated count of documents in the collection.
   *
   * @param options - Optional options including signal for cancellation
   * @returns Promise resolving to the estimated document count
   *
   * @remarks
   * Returns a fast estimate of the document count using SQLite table statistics.
   * This is much faster than count() for large collections but may not be exact.
   *
   * Uses SQLite's internal statistics which are updated periodically.
   * For exact counts, use the count() method instead.
   *
   * @example
   * ```typescript
   * const estimate = await users.estimatedDocumentCount();
   * console.log(`Approximately ${estimate} users`);
   *
   * // Compare with exact count
   * const exact = await users.count({});
   * console.log(`Exact: ${exact}, Estimated: ${estimate}`);
   *
   * // With abort signal
   * const controller = new AbortController();
   * const estimate = await users.estimatedDocumentCount({ signal: controller.signal });
   * ```
   */
  estimatedDocumentCount(options?: {
    signal?: AbortSignal
    retry?: RetryOptions | false
  }): Promise<number>

  /**
   * Drop the collection (delete the table).
   *
   * @returns Promise resolving when the collection is dropped
   *
   * @remarks
   * Permanently deletes the collection and all its documents.
   * This operation cannot be undone.
   *
   * The table and all associated indexes are removed from the database.
   * Use with caution in production environments.
   *
   * @example
   * ```typescript
   * // Drop a temporary collection
   * await tempCollection.drop();
   *
   * // Drop with confirmation
   * if (confirm('Really delete all users?')) {
   *   await users.drop();
   * }
   *
   * // With abort signal
   * const controller = new AbortController();
   * await collection.drop({ signal: controller.signal });
   * ```
   */
  drop(options?: {
    signal?: AbortSignal
    retry?: RetryOptions | false
  }): Promise<void>

  // ===== Validation =====

  /**
   * Validate a document against the schema (async).
   *
   * @param doc - Document to validate
   * @returns Promise resolving to true if valid
   *
   * @remarks
   * Validates the document against the schema validator.
   * Supports both synchronous and asynchronous validators.
   * Throws `ValidationError` if validation fails.
   *
   * @throws {ValidationError} If document fails validation
   *
   * @example
   * ```typescript
   * try {
   *   await users.validate({
   *     name: 'Alice',
   *     email: 'invalid-email',
   *     age: -5,
   *     role: 'admin'
   *   });
   * } catch (err) {
   *   if (err instanceof ValidationError) {
   *     console.error(`Invalid field: ${err.field}`);
   *     console.error(`Error: ${err.message}`);
   *   }
   * }
   *
   * // With abort signal
   * const controller = new AbortController();
   * await users.validate(doc, { signal: controller.signal });
   * ```
   */
  validate(
    doc: unknown,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<T>

  /**
   * Validate a document against the schema (sync).
   *
   * @param doc - Document to validate
   * @returns True if valid
   *
   * @remarks
   * Synchronous version of `validate()`. Only works with synchronous validators.
   * Throws error if the schema uses async validators.
   *
   * @throws {ValidationError} If document fails validation
   * @throws {TypeError} If schema uses async validators
   *
   * @example
   * ```typescript
   * try {
   *   users.validateSync({ name: 'Alice', email: 'alice@example.com', age: 30, role: 'admin' });
   *   console.log('Document is valid');
   * } catch (err) {
   *   console.error('Validation failed:', err.message);
   * }
   * ```
   */
  validateSync(doc: unknown): T

  // ===== Event Methods =====

  /**
   * Register an event listener for collection events.
   *
   * @typeParam E - The event name type
   * @param event - The event name to listen for
   * @param listener - The callback function to invoke when the event is emitted
   * @returns The collection instance for method chaining
   *
   * @remarks
   * Registers a listener function that will be called whenever the specified
   * event is emitted. The listener receives the event payload as its argument.
   *
   * The event emitter is lazily initialized on the first call to `on()`,
   * ensuring zero overhead when events are not used.
   *
   * All events are emitted **after** the operation completes successfully.
   * Events do not fire if the operation throws an error (except for 'error' events).
   *
   * @example
   * ```typescript
   * // Audit logging
   * users.on('insert', (event) => {
   *   console.log(`New user created: ${event.document._id}`)
   *   auditLog.record('user.created', event.document)
   * })
   *
   * // Cache invalidation
   * users.on('update', (event) => {
   *   if (event.document) {
   *     cache.invalidate(`user:${event.document._id}`)
   *   }
   * })
   *
   * // Error monitoring
   * users.on('error', (event) => {
   *   errorTracker.capture(event.error, {
   *     operation: event.operation,
   *     context: event.context
   *   })
   * })
   *
   * // Method chaining
   * users
   *   .on('insert', logInsert)
   *   .on('update', logUpdate)
   *   .on('delete', logDelete)
   * ```
   */
  on<E extends CollectionEventName>(
    event: E,
    listener: (...args: CollectionEventMap<T>[E]) => void
  ): Collection<T>

  /**
   * Register a one-time event listener.
   *
   * @typeParam E - The event name type
   * @param event - The event name to listen for
   * @param listener - The callback function to invoke once
   * @returns The collection instance for method chaining
   *
   * @remarks
   * Registers a listener that will be automatically removed after it is
   * invoked once. Useful for setup tasks or one-time notifications.
   *
   * @example
   * ```typescript
   * // Log only the first user creation
   * users.once('insert', (event) => {
   *   console.log('First user created:', event.document._id)
   * })
   *
   * // One-time initialization
   * users.once('insert', async (event) => {
   *   await initializeUserMetrics()
   * })
   * ```
   */
  once<E extends CollectionEventName>(
    event: E,
    listener: (...args: CollectionEventMap<T>[E]) => void
  ): Collection<T>

  /**
   * Remove an event listener.
   *
   * @typeParam E - The event name type
   * @param event - The event name
   * @param listener - The callback function to remove
   * @returns The collection instance for method chaining
   *
   * @remarks
   * Removes a previously registered listener. The listener reference must
   * be the same function reference that was passed to `on()` or `once()`.
   *
   * If the listener was not registered, this method has no effect.
   *
   * @example
   * ```typescript
   * // Define listener function
   * const logInsert = (event: InsertEvent<User>) => {
   *   console.log('User inserted:', event.document._id)
   * }
   *
   * // Register listener
   * users.on('insert', logInsert)
   *
   * // Later, remove it
   * users.off('insert', logInsert)
   *
   * // Note: Arrow functions must use the same reference
   * const listener = (event) => console.log(event)
   * users.on('insert', listener)
   * users.off('insert', listener) // Works
   *
   * // This won't work (different function reference):
   * users.on('insert', (event) => console.log(event))
   * users.off('insert', (event) => console.log(event)) // Does nothing
   * ```
   */
  off<E extends CollectionEventName>(
    event: E,
    listener: (...args: CollectionEventMap<T>[E]) => void
  ): Collection<T>

  /**
   * Remove all listeners for an event, or all events if no event specified.
   *
   * @param event - Optional event name to clear listeners for
   * @returns The collection instance for method chaining
   *
   * @remarks
   * If an event name is provided, removes all listeners for that event.
   * If no event name is provided, removes all listeners for all events.
   *
   * Use with caution in shared codebases where multiple parts of the
   * application might be listening to the same events.
   *
   * @example
   * ```typescript
   * // Remove all 'insert' listeners
   * users.removeAllListeners('insert')
   *
   * // Remove all listeners for all events
   * users.removeAllListeners()
   *
   * // Cleanup before disposal
   * function cleanup() {
   *   users.removeAllListeners()
   *   db.close()
   * }
   * ```
   */
  removeAllListeners(event?: CollectionEventName): Collection<T>

  /**
   * Get the number of listeners for an event.
   *
   * @param event - The event name
   * @returns Number of registered listeners for the event
   *
   * @remarks
   * Returns the count of listeners currently registered for the specified event.
   * Useful for debugging or monitoring event listener usage.
   *
   * Returns 0 if no listeners are registered or if the event emitter
   * has not been initialized yet.
   *
   * @example
   * ```typescript
   * // Check if anyone is listening
   * if (users.listenerCount('insert') === 0) {
   *   console.log('No insert listeners registered')
   * }
   *
   * // Monitor listener count
   * users.on('insert', listener1)
   * users.on('insert', listener2)
   * console.log(users.listenerCount('insert')) // 2
   *
   * users.off('insert', listener1)
   * console.log(users.listenerCount('insert')) // 1
   * ```
   */
  listenerCount(event: CollectionEventName): number

  /**
   * Get all listeners for an event.
   *
   * @typeParam E - The event name type
   * @param event - The event name
   * @returns Array of listener functions registered for the event
   *
   * @remarks
   * Returns an array of all listener functions currently registered for
   * the specified event. The array is a copy, so modifying it won't affect
   * the actual listeners.
   *
   * Returns an empty array if no listeners are registered or if the event
   * emitter has not been initialized yet.
   *
   * @example
   * ```typescript
   * // Get all insert listeners
   * const insertListeners = users.listeners('insert')
   * console.log(`${insertListeners.length} listeners registered`)
   *
   * // Iterate over listeners
   * for (const listener of users.listeners('update')) {
   *   console.log('Listener:', listener.name)
   * }
   *
   * // Check if specific listener is registered
   * const hasListener = users.listeners('delete').includes(myListener)
   * ```
   */
  listeners<E extends CollectionEventName>(
    event: E
  ): ((...args: CollectionEventMap<T>[E]) => void)[]

  /**
   * Cleans up event emitter resources.
   * Called internally when collection is dropped or database is closed.
   * @internal
   */
  cleanupEvents(): void
}
