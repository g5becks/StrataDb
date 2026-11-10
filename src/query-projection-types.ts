/**
 * Sort specification for query result ordering.
 *
 * @typeParam T - The document type being queried
 *
 * @remarks
 * Defines sort order for query results using MongoDB-style sort syntax.
 * Each field can be sorted in ascending (1) or descending (-1) order.
 * Multiple fields can be specified for multi-level sorting.
 *
 * Sort order matters: fields are sorted left-to-right as specified.
 *
 * @example
 * ```typescript
 * type User = Document<{
 *   name: string;
 *   age: number;
 *   createdAt: Date;
 *   status: 'active' | 'inactive';
 * }>;
 *
 * // ✅ Single field sort
 * const byAge: SortSpec<User> = {
 *   age: 1  // Ascending order
 * };
 *
 * // ✅ Descending order
 * const byNewest: SortSpec<User> = {
 *   createdAt: -1  // Most recent first
 * };
 *
 * // ✅ Multi-field sort
 * const byStatusThenAge: SortSpec<User> = {
 *   status: 1,   // First by status (ascending)
 *   age: -1      // Then by age (descending)
 * };
 *
 * // ✅ Complex sort
 * const complexSort: SortSpec<User> = {
 *   status: 1,      // Active users first
 *   createdAt: -1,  // Then newest first
 *   name: 1         // Then alphabetically
 * };
 *
 * // Usage with collection
 * const results = await users.find(
 *   { status: 'active' },
 *   { sort: { createdAt: -1, name: 1 } }
 * );
 * ```
 */
export type SortSpec<T> = {
  readonly [K in keyof T]?: 1 | -1
}

/**
 * Projection specification for field selection in query results.
 *
 * @typeParam T - The document type being queried
 *
 * @remarks
 * Controls which fields are included in or excluded from query results.
 * Uses MongoDB-style projection syntax:
 * - `1` or `true`: Include the field
 * - `0` or `false`: Exclude the field
 *
 * **Important rules:**
 * - Cannot mix inclusion and exclusion (except for `id` field)
 * - Either specify fields to include OR fields to exclude
 * - The `id` field is always included unless explicitly excluded
 *
 * @example
 * ```typescript
 * type User = Document<{
 *   name: string;
 *   email: string;
 *   password: string;
 *   age: number;
 *   createdAt: Date;
 * }>;
 *
 * // ✅ Include specific fields (exclude all others)
 * const publicFields: ProjectionSpec<User> = {
 *   name: 1,
 *   email: 1,
 *   age: 1
 *   // password, createdAt excluded
 * };
 *
 * // ✅ Exclude specific fields (include all others)
 * const withoutPassword: ProjectionSpec<User> = {
 *   password: 0
 *   // name, email, age, createdAt included
 * };
 *
 * // ✅ Exclude multiple fields
 * const minimalUser: ProjectionSpec<User> = {
 *   password: 0,
 *   createdAt: 0
 * };
 *
 * // ✅ Exclude id field
 * const noId: ProjectionSpec<User> = {
 *   id: 0,
 *   name: 1,
 *   email: 1
 * };
 *
 * // Usage with collection
 * const users = await collection.find(
 *   { status: 'active' },
 *   { projection: { name: 1, email: 1 } }
 * );
 * ```
 */
export type ProjectionSpec<T> = {
  readonly [K in keyof T]?: 1 | 0
}

/**
 * Array-based field selection for query results (inclusion).
 *
 * @typeParam T - The document type being queried
 *
 * @remarks
 * Provides a cleaner, more intuitive alternative to `projection: { field: 1 }`
 * for specifying which fields to include in query results. Instead of using
 * MongoDB-style projection objects, simply pass an array of field names.
 *
 * **How it works:**
 * - Only the specified fields (plus `_id`) will be returned
 * - All other fields are excluded from the result
 * - The `_id` field is always included automatically
 *
 * **When to use `select` vs `projection`:**
 * - Use `select` when you want to include specific fields (most common case)
 * - Use `projection` when you need more control (e.g., excluding `_id`)
 * - Cannot use both `select` and `projection` in the same query
 *
 * @example
 * ```typescript
 * import type { SelectSpec, Document } from 'stratadb';
 *
 * type User = Document<{
 *   name: string;
 *   email: string;
 *   password: string;
 *   age: number;
 *   status: 'active' | 'inactive';
 * }>;
 *
 * // ✅ Select specific fields to return
 * const publicFields: SelectSpec<User> = ['name', 'email', 'age'];
 *
 * // ✅ Minimal fields for list view
 * const listFields: SelectSpec<User> = ['name', 'status'];
 *
 * // Usage with collection.find()
 * const users = await collection.find(
 *   { status: 'active' },
 *   { select: ['name', 'email'] }
 * );
 * // Returns: [{ _id: '...', name: 'Alice', email: 'alice@example.com' }, ...]
 *
 * // ✅ Combining with sort and limit
 * const results = await collection.find(
 *   { status: 'active' },
 *   {
 *     select: ['name', 'email', 'createdAt'],
 *     sort: { createdAt: -1 },
 *     limit: 10
 *   }
 * );
 * ```
 */
export type SelectSpec<T> = readonly (keyof T)[]

/**
 * Array-based field exclusion for query results.
 *
 * @typeParam T - The document type being queried
 *
 * @remarks
 * Provides a cleaner, more intuitive alternative to `projection: { field: 0 }`
 * for specifying which fields to exclude from query results. Instead of using
 * MongoDB-style projection objects, simply pass an array of field names to omit.
 *
 * **How it works:**
 * - All fields except the specified ones will be returned
 * - The `_id` field is always included (use projection to exclude it)
 * - Useful for excluding sensitive fields like passwords or tokens
 *
 * **When to use `omit` vs `projection`:**
 * - Use `omit` when you want to exclude a few specific fields
 * - Use `projection` when you need more control (e.g., excluding `_id`)
 * - Cannot use both `omit` and `select` in the same query
 * - Cannot use `omit` with `projection` in the same query
 *
 * @example
 * ```typescript
 * import type { OmitSpec, Document } from 'stratadb';
 *
 * type User = Document<{
 *   name: string;
 *   email: string;
 *   password: string;
 *   ssn: string;
 *   age: number;
 *   status: 'active' | 'inactive';
 * }>;
 *
 * // ✅ Omit sensitive fields
 * const safeFields: OmitSpec<User> = ['password', 'ssn'];
 *
 * // ✅ Omit internal fields
 * const publicFields: OmitSpec<User> = ['password'];
 *
 * // Usage with collection.find()
 * const users = await collection.find(
 *   { status: 'active' },
 *   { omit: ['password', 'ssn'] }
 * );
 * // Returns: [{ _id: '...', name: 'Alice', email: 'alice@...', age: 30, status: 'active' }, ...]
 *
 * // ✅ Combining with sort and limit
 * const results = await collection.find(
 *   { status: 'active' },
 *   {
 *     omit: ['password'],
 *     sort: { createdAt: -1 },
 *     limit: 10
 *   }
 * );
 * ```
 */
export type OmitSpec<T> = readonly (keyof T)[]

/**
 * Helper type to extract the result type based on projection options.
 * Returns Pick<T, K | '_id'> for select, Omit<T, K> for omit, or T for no projection.
 */
export type ProjectedDocument<T, K extends keyof T = never> = [K] extends [
  never,
]
  ? T
  : Pick<T, K | (keyof T & "_id")>
