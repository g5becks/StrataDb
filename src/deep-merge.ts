import { deepmergeCustom } from "deepmerge-ts"
import { serializeJSON } from "./json-serialization.js"

/**
 * Custom deep merge function optimized for document updates.
 *
 * @remarks
 * This merge function is specifically designed for merging partial document updates
 * with existing documents in StrataDB collections. It provides the following behavior:
 *
 * **Array Handling:**
 * - Arrays are replaced, not concatenated
 * - `update: { tags: ['new'] }` completely replaces existing tags array
 *
 * **Undefined Values:**
 * - Preserved to enable field deletion
 * - `update: { field: undefined }` will set field to undefined
 *
 * **Nested Objects:**
 * - Deep merged recursively
 * - `update: { profile: { age: 30 } }` merges into existing profile object
 *
 * **Prototype Pollution Prevention:**
 * - Automatically protected by deepmerge-ts
 * - __proto__, constructor, and prototype keys are handled safely
 *
 * @example
 * ```typescript
 * const existing = {
 *   name: 'Alice',
 *   profile: { age: 25, city: 'NYC' },
 *   tags: ['user', 'active']
 * };
 *
 * const update = {
 *   profile: { age: 26 },  // Merge into profile
 *   tags: ['admin'],       // Replace tags array
 *   email: 'alice@example.com'  // Add new field
 * };
 *
 * const result = deepMerge(existing, update);
 * // {
 * //   name: 'Alice',
 * //   profile: { age: 26, city: 'NYC' },  // age updated, city preserved
 * //   tags: ['admin'],                      // array replaced
 * //   email: 'alice@example.com'          // field added
 * // }
 * ```
 *
 * @example
 * ```typescript
 * // Field deletion with undefined
 * const existing = {
 *   name: 'Bob',
 *   email: 'bob@example.com',
 *   phone: '555-1234'
 * };
 *
 * const update = {
 *   phone: undefined  // Delete phone field
 * };
 *
 * const result = deepMerge(existing, update);
 * // {
 * //   name: 'Bob',
 * //   email: 'bob@example.com',
 * //   phone: undefined  // Preserved for deletion
 * // }
 * ```
 */
export const deepMerge: (...objects: readonly unknown[]) => unknown =
  deepmergeCustom({
    /**
     * Replace arrays instead of concatenating them.
     * This ensures array updates completely replace the old array.
     */
    mergeArrays: false,

    /**
     * Keep undefined values to allow field deletion.
     * By default, deepmerge-ts filters out undefined.
     */
    filterValues: false,
  })

/**
 * Type-safe deep merge function for document updates in collections.
 *
 * @typeParam T - The complete document type including metadata fields
 *
 * @param existingBody - The existing document body without metadata (Omit<T, "id">)
 * @param metadata - Required metadata fields (id, updatedAt) plus optional update fields
 * @returns Complete document of type T with all fields properly merged
 *
 * @remarks
 * This function is specifically designed for merging partial updates with existing
 * documents in StrataDB collections. It handles the common pattern where:
 * 1. We read the document body (without id) from storage
 * 2. We have metadata fields (id, updatedAt, etc.) to add back
 * 3. We have partial update fields to merge in
 * 4. We need a complete document as the result
 *
 * **Type Safety:**
 * - No type assertions needed at call sites
 * - TypeScript infers the complete document type automatically
 * - Ensures all required fields are present in the result
 *
 * **Deep Merge Behavior:**
 * - Nested objects are merged recursively
 * - Arrays are replaced (not concatenated)
 * - Undefined values preserved for deletion
 *
 * @example
 * ```typescript
 * type User = Document<{
 *   name: string;
 *   profile: { age: number; city: string };
 *   tags: string[];
 * }>;
 *
 * const existingBody: Omit<User, "_id"> = {
 *   name: 'Alice',
 *   profile: { age: 25, city: 'NYC' },
 *   tags: ['user'],
 *   createdAt: 1000,
 *   updatedAt: 1000
 * };
 *
 * const merged = mergeDocumentUpdate<User>(existingBody, {
 *   _id: 'user-123',
 *   updatedAt: 2000,
 *   profile: { age: 26 }  // Partial update
 * });
 *
 * // Type: User (no casting needed!)
 * // Value: {
 * //   _id: 'user-123',
 * //   name: 'Alice',
 * //   profile: { age: 26, city: 'NYC' },  // Deep merged
 * //   tags: ['user'],
 * //   createdAt: 1000,
 * //   updatedAt: 2000
 * // }
 * ```
 */
export function mergeDocumentUpdate<
  T extends { _id: string },
  U extends { _id: string },
>(existingBody: Omit<T, "_id">, metadata: U): T {
  // deepmerge-ts returns a complex inferred type that represents the merge result
  // For our use case (merging document body with metadata), the runtime result IS type T
  // TypeScript cannot prove this statically due to the complexity of deep merge inference
  serializeJSON(metadata)
  return deepMerge(existingBody, metadata) as T
}
