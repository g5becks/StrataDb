import type { CursorSpec } from "./cursor-types.js"

import type {
  OmitSpec,
  ProjectionSpec,
  SelectSpec,
  SortSpec,
} from "./query-projection-types.js"
import type { RetryOptions } from "./retry-types.js"

export type { CursorSpec } from "./cursor-types.js"

export type {
  OmitSpec,
  ProjectedDocument,
  ProjectionSpec,
  SelectSpec,
  SortSpec,
} from "./query-projection-types.js"

/**
 * Text search configuration for literal multi-field substring searching.
 *
 * @typeParam T - The document type being searched
 *
 * @remarks
 * Enables searching across multiple document fields simultaneously using
 * literal text with optional ASCII case folding. This supports search
 * boxes, autocomplete, and filtering features.
 *
 * **How it works:**
 * - Percent, underscore and backslash in `text` remain literal
 * - All specified `fields` are searched with OR logic (match any field)
 * - By default, search folds ASCII case; non-ASCII case is preserved
 * - Set `caseSensitive: true` for exact case matching
 *
 * **Field paths:**
 * - Use field names directly for top-level fields: `['name', 'email']`
 * - Use dot notation for nested fields: `['profile.bio', 'address.city']`
 * - Mix both: `['name', 'profile.bio', 'tags']`
 *
 * **Performance considerations:**
 * - Indexed fields are searched more efficiently
 * - Searching many fields increases query complexity
 * - For large datasets, consider using dedicated search solutions
 *
 * @example
 * ```typescript
 * import type { TextSearchSpec, Document } from 'stratadb';
 *
 * type User = Document<{
 *   name: string;
 *   email: string;
 *   profile: {
 *     bio: string;
 *     company: string;
 *   };
 * }>;
 *
 * // Search across name and email
 * const simpleSearch: TextSearchSpec<User> = {
 *   text: 'alice',
 *   fields: ['name', 'email']
 * };
 *
 * // Search including nested fields
 * const nestedSearch: TextSearchSpec<User> = {
 *   text: 'engineer',
 *   fields: ['name', 'profile.bio', 'profile.company']
 * };
 *
 * // Case-sensitive search
 * const caseSensitiveSearch: TextSearchSpec<User> = {
 *   text: 'Alice',
 *   fields: ['name'],
 *   caseSensitive: true
 * };
 *
 * // Usage with collection.find()
 * const results = await users.find(
 *   { status: 'active' },
 *   {
 *     search: {
 *       text: 'alice',
 *       fields: ['name', 'email']
 *     },
 *     limit: 10
 *   }
 * );
 * ```
 */
export type TextSearchSpec<T> = {
  /** Literal substring text; percent, underscore and backslash stay literal */
  readonly text: string

  /**
   * Fields to search. Use field names for top-level, dot notation for nested.
   * All fields are searched with OR logic (match any).
   */
  readonly fields: readonly (keyof T | string)[]

  /** Whether to perform case-sensitive matching. Default: false (case-insensitive) */
  readonly caseSensitive?: boolean
}

/**
 * Complete query options for controlling result set behavior.
 *
 * @typeParam T - The document type being queried
 *
 * @remarks
 * Combines all query result control options:
 * - `sort`: Order results by one or more fields
 * - `limit`: Maximum number of results to return
 * - `skip`: Number of results to skip (for pagination)
 * - `select`: Array of fields to include (cleaner than projection)
 * - `omit`: Array of fields to exclude (cleaner than projection)
 * - `projection`: Which fields to include/exclude (MongoDB-style)
 *
 * **Field selection options (mutually exclusive):**
 * - Use `select` to include specific fields: `{ select: ['name', 'email'] }`
 * - Use `omit` to exclude specific fields: `{ omit: ['password'] }`
 * - Use `projection` for MongoDB-style control: `{ projection: { name: 1 } }`
 * - Cannot combine `select`, `omit`, or `projection` in the same query
 *
 * These options work together to enable:
 * - Pagination (limit + skip)
 * - Sorting (sort)
 * - Field selection (select, omit, or projection)
 * - Performance optimization (limit + select/omit)
 *
 * @example
 * ```typescript
 * type User = Document<{
 *   name: string;
 *   email: string;
 *   age: number;
 *   status: 'active' | 'inactive';
 *   createdAt: Date;
 * }>;
 *
 * // ✅ Pagination with sorting
 * const page2: QueryOptions<User> = {
 *   sort: { createdAt: -1 },  // Newest first
 *   limit: 20,                // 20 per page
 *   skip: 20                  // Skip first page
 * };
 *
 * // ✅ Sorted results with field selection
 * const publicUsers: QueryOptions<User> = {
 *   sort: { name: 1 },
 *   projection: {
 *     name: 1,
 *     email: 1
 *     // Excludes age, status, createdAt
 *   }
 * };
 *
 * // ✅ Top 10 most recent
 * const recent: QueryOptions<User> = {
 *   sort: { createdAt: -1 },
 *   limit: 10
 * };
 *
 * // ✅ Complex pagination pattern
 * function getPage(pageNum: number, pageSize: number): QueryOptions<User> {
 *   return {
 *     sort: { createdAt: -1, name: 1 },
 *     limit: pageSize,
 *     skip: (pageNum - 1) * pageSize,
 *     projection: { name: 1, email: 1, status: 1 }
 *   };
 * }
 *
 * // ✅ Performance optimization
 * const optimized: QueryOptions<User> = {
 *   limit: 100,              // Limit results
 *   projection: {            // Only needed fields
 *     name: 1,
 *     status: 1
 *   }
 * };
 *
 * // Usage with collection
 * const results = await users.find(
 *   { status: 'active' },
 *   {
 *     sort: { createdAt: -1 },
 *     limit: 20,
 *     skip: 0,
 *     projection: { name: 1, email: 1 }
 *   }
 * );
 *
 * // Pagination helper
 * async function fetchPage(page: number, perPage: number = 20) {
 *   return await users.find(
 *     {},
 *     {
 *       sort: { createdAt: -1 },
 *       limit: perPage,
 *       skip: (page - 1) * perPage
 *     }
 *   );
 * }
 *
 * // ✅ Using select (cleaner field inclusion)
 * const withSelect: QueryOptions<User> = {
 *   select: ['name', 'email', 'status'],  // Only these fields + _id
 *   sort: { name: 1 }
 * };
 *
 * // ✅ Using omit (exclude sensitive fields)
 * const withOmit: QueryOptions<User> = {
 *   omit: ['password'],  // All fields except password
 *   sort: { createdAt: -1 },
 *   limit: 10
 * };
 *
 * // Usage with collection
 * const publicUsers = await users.find(
 *   { status: 'active' },
 *   { select: ['name', 'email'] }
 * );
 *
 * const safeUsers = await users.find(
 *   {},
 *   { omit: ['password', 'ssn'] }
 * );
 * ```
 */
/**
 * Base query options without projection (returns full document type).
 *
 * @typeParam T - The document type being queried
 */
export type QueryOptionsBase<T> = {
  /** Sort order for results (MongoDB-style: 1 = asc, -1 = desc) */
  readonly sort?: SortSpec<T>

  /** Maximum number of documents to return */
  readonly limit?: number

  /** Number of documents to skip (for pagination) */
  readonly skip?: number

  /**
   * Multi-field text search configuration.
   * Searches across specified fields with OR logic (match any field).
   * Combined with filter using AND logic.
   */
  readonly search?: TextSearchSpec<T>

  /**
   * Cursor-based pagination configuration.
   * Requires `sort` to be set. More efficient than skip/limit for large datasets.
   */
  readonly cursor?: CursorSpec

  /**
   * AbortSignal for cancelling the operation.
   * When the signal is aborted, the operation will throw an AbortedError.
   */
  readonly signal?: AbortSignal

  /**
   * Retry configuration for this operation.
   * Overrides collection and database-level retry settings.
   * Pass `false` to disable retries for this operation.
   */
  readonly retry?: RetryOptions | false
}

/**
 * Query options with `select` for type-safe field inclusion.
 *
 * @typeParam T - The document type being queried
 * @typeParam K - The keys to select (inferred from the select array)
 *
 * @remarks
 * When using `select`, the return type is narrowed to only include the
 * selected fields plus `_id`. This provides compile-time type safety.
 *
 * @example
 * ```typescript
 * // Returns Pick<User, '_id' | 'name' | 'email'>[]
 * const users = await collection.find(
 *   { status: 'active' },
 *   { select: ['name', 'email'] as const }
 * );
 * users[0].name   // ✅ TypeScript knows this exists
 * users[0].password // ❌ TypeScript error: property doesn't exist
 * ```
 */
export type QueryOptionsWithSelect<
  T,
  K extends keyof T,
> = QueryOptionsBase<T> & {
  /** Array of fields to include in results (plus _id). */
  readonly select: readonly K[]
  readonly omit?: never
  readonly projection?: never
}

/**
 * Query options with `omit` for type-safe field exclusion.
 *
 * @typeParam T - The document type being queried
 * @typeParam K - The keys to omit (inferred from the omit array)
 *
 * @remarks
 * When using `omit`, the return type excludes the specified fields.
 * This provides compile-time type safety.
 *
 * @example
 * ```typescript
 * // Returns Omit<User, 'password' | 'ssn'>[]
 * const users = await collection.find(
 *   { status: 'active' },
 *   { omit: ['password', 'ssn'] as const }
 * );
 * users[0].name     // ✅ TypeScript knows this exists
 * users[0].password // ❌ TypeScript error: property doesn't exist
 * ```
 */
export type QueryOptionsWithOmit<T, K extends keyof T> = QueryOptionsBase<T> & {
  /** Array of fields to exclude from results. */
  readonly omit: readonly K[]
  readonly select?: never
  readonly projection?: never
}

/**
 * Query options without any projection (returns full document type).
 *
 * @typeParam T - The document type being queried
 */
export type QueryOptionsWithoutProjection<T> = QueryOptionsBase<T> & {
  readonly select?: never
  readonly omit?: never
  readonly projection?: never
}

/**
 * Complete query options for controlling result set behavior.
 *
 * @typeParam T - The document type being queried
 *
 * @remarks
 * Combines all query result control options:
 * - `sort`: Order results by one or more fields
 * - `limit`: Maximum number of results to return
 * - `skip`: Number of results to skip (for pagination)
 * - `select`: Array of fields to include (cleaner than projection)
 * - `omit`: Array of fields to exclude (cleaner than projection)
 * - `projection`: Which fields to include/exclude (MongoDB-style)
 *
 * **Field selection options (mutually exclusive):**
 * - Use `select` to include specific fields: `{ select: ['name', 'email'] }`
 * - Use `omit` to exclude specific fields: `{ omit: ['password'] }`
 * - Use `projection` for MongoDB-style control: `{ projection: { name: 1 } }`
 * - Cannot combine `select`, `omit`, or `projection` in the same query
 *
 * These options work together to enable:
 * - Pagination (limit + skip)
 * - Sorting (sort)
 * - Field selection (select, omit, or projection)
 * - Performance optimization (limit + select/omit)
 *
 * @example
 * ```typescript
 * type User = Document<{
 *   name: string;
 *   email: string;
 *   age: number;
 *   status: 'active' | 'inactive';
 *   createdAt: Date;
 * }>;
 *
 * // ✅ Pagination with sorting
 * const page2: QueryOptions<User> = {
 *   sort: { createdAt: -1 },  // Newest first
 *   limit: 20,                // 20 per page
 *   skip: 20                  // Skip first page
 * };
 *
 * // ✅ Sorted results with field selection
 * const publicUsers: QueryOptions<User> = {
 *   sort: { name: 1 },
 *   projection: {
 *     name: 1,
 *     email: 1
 *     // Excludes age, status, createdAt
 *   }
 * };
 *
 * // ✅ Top 10 most recent
 * const recent: QueryOptions<User> = {
 *   sort: { createdAt: -1 },
 *   limit: 10
 * };
 *
 * // ✅ Complex pagination pattern
 * function getPage(pageNum: number, pageSize: number): QueryOptions<User> {
 *   return {
 *     sort: { createdAt: -1, name: 1 },
 *     limit: pageSize,
 *     skip: (pageNum - 1) * pageSize,
 *     projection: { name: 1, email: 1, status: 1 }
 *   };
 * }
 *
 * // ✅ Performance optimization
 * const optimized: QueryOptions<User> = {
 *   limit: 100,              // Limit results
 *   projection: {            // Only needed fields
 *     name: 1,
 *     status: 1
 *   }
 * };
 *
 * // Usage with collection
 * const results = await users.find(
 *   { status: 'active' },
 *   {
 *     sort: { createdAt: -1 },
 *     limit: 20,
 *     skip: 0,
 *     projection: { name: 1, email: 1 }
 *   }
 * );
 *
 * // Pagination helper
 * async function fetchPage(page: number, perPage: number = 20) {
 *   return await users.find(
 *     {},
 *     {
 *       sort: { createdAt: -1 },
 *       limit: perPage,
 *       skip: (page - 1) * perPage
 *     }
 *   );
 * }
 *
 * // ✅ Using select (cleaner field inclusion)
 * const withSelect: QueryOptions<User> = {
 *   select: ['name', 'email', 'status'],  // Only these fields + _id
 *   sort: { name: 1 }
 * };
 *
 * // ✅ Using omit (exclude sensitive fields)
 * const withOmit: QueryOptions<User> = {
 *   omit: ['password'],  // All fields except password
 *   sort: { createdAt: -1 },
 *   limit: 10
 * };
 *
 * // Usage with collection
 * const publicUsers = await users.find(
 *   { status: 'active' },
 *   { select: ['name', 'email'] }
 * );
 *
 * const safeUsers = await users.find(
 *   {},
 *   { omit: ['password', 'ssn'] }
 * );
 * ```
 */
export type QueryOptions<T> = {
  /** Sort order for results (MongoDB-style: 1 = asc, -1 = desc) */
  readonly sort?: SortSpec<T>

  /** Maximum number of documents to return */
  readonly limit?: number

  /** Number of documents to skip (for pagination) */
  readonly skip?: number

  /**
   * Array of fields to include in results (plus _id).
   * Mutually exclusive with `omit` and `projection`.
   */
  readonly select?: SelectSpec<T>

  /**
   * Array of fields to exclude from results.
   * Mutually exclusive with `select` and `projection`.
   */
  readonly omit?: OmitSpec<T>

  /**
   * Which fields to include (1) or exclude (0) from results.
   * Mutually exclusive with `select` and `omit`.
   */
  readonly projection?: ProjectionSpec<T>

  /**
   * Multi-field text search configuration.
   * Searches across specified fields with OR logic (match any field).
   * Combined with filter using AND logic.
   */
  readonly search?: TextSearchSpec<T>

  /**
   * Cursor-based pagination configuration.
   * Requires `sort` to be set. More efficient than skip/limit for large datasets.
   */
  readonly cursor?: CursorSpec

  /**
   * AbortSignal for cancelling the operation.
   * When the signal is aborted, the operation will throw an AbortedError.
   */
  readonly signal?: AbortSignal

  /**
   * Retry configuration for this operation.
   * Overrides collection and database-level retry settings.
   * Pass `false` to disable retries for this operation.
   */
  readonly retry?: RetryOptions | false
}
