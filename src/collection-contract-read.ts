import type { Document } from "./core-types.js"
import type {
  QueryOptions,
  QueryOptionsWithOmit,
  QueryOptionsWithSelect,
} from "./query-options-types.js"
import type { QueryFilter } from "./query-types.js"
import type { RetryOptions } from "./retry-types.js"
import type { SchemaDefinition } from "./schema-types.js"
/** Read members of {@link Collection}. */
export type CollectionReadContract<T extends Document> = {
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
}
