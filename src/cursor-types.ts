/**
 * Cursor-based pagination specification for efficient large dataset navigation.
 *
 * @typeParam T - The document type being paginated
 *
 * @remarks
 * Cursor pagination provides consistent, efficient pagination that doesn't suffer
 * from the "shifting window" problem of skip/limit pagination. It's especially
 * beneficial for:
 *
 * - **Large datasets**: O(1) vs O(n) for skip-based pagination
 * - **Real-time data**: New inserts don't affect pagination position
 * - **Consistent ordering**: Results remain stable across page requests
 *
 * **How it works:**
 * - Use `after` to get items after a specific cursor (forward pagination)
 * - Use `before` to get items before a specific cursor (backward pagination)
 * - The cursor is the `_id` of the boundary document
 *
 * **Requirements:**
 * - A `sort` option MUST be provided when using cursor pagination
 * - The `limit` option should be set to control page size
 *
 * **Cursor value format:**
 * The cursor is simply the `_id` of the last/first document from the previous page.
 * All sort values are read from the boundary row and compared lexicographically.
 * Sorted finds append ascending `_id` unless explicitly supplied. NULL/missing
 * values sort first ascending and last descending. `before` returns the nearest
 * previous page in the requested order. Unknown/malformed cursors or a cursor
 * without a nonempty sort reject with QueryError.
 *
 * @example
 * ```typescript
 * import type { CursorSpec, Document } from 'stratadb';
 *
 * type User = Document<{
 *   name: string;
 *   createdAt: number;
 * }>;
 *
 * // Forward pagination - get next page after cursor
 * const page2: CursorSpec = {
 *   after: 'user-abc123'  // _id of last item from page 1
 * };
 *
 * // Usage with collection.find()
 * const firstPage = await users.find(
 *   { status: 'active' },
 *   { sort: { createdAt: -1 }, limit: 20 }
 * );
 *
 * // Get next page using last item's _id as cursor
 * const lastItem = firstPage[firstPage.length - 1];
 * const secondPage = await users.find(
 *   { status: 'active' },
 *   {
 *     sort: { createdAt: -1 },
 *     limit: 20,
 *     cursor: { after: lastItem._id }
 *   }
 * );
 *
 * // Backward pagination - get previous page
 * const firstItem = secondPage[0];
 * const backToFirstPage = await users.find(
 *   { status: 'active' },
 *   {
 *     sort: { createdAt: -1 },
 *     limit: 20,
 *     cursor: { before: firstItem._id }
 *   }
 * );
 * ```
 */
export type CursorSpec = {
  /**
   * Get items after this cursor (forward pagination).
   * Value is the `_id` of the boundary document.
   */
  readonly after?: string

  /**
   * Get items before this cursor (backward pagination).
   * Value is the `_id` of the boundary document.
   */
  readonly before?: string
}
