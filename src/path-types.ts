import type { Get, Paths } from "type-fest"

/**
 * JSON path for accessing nested document properties in SQLite.
 *
 * @remarks
 * Must start with `$.` and use dot notation for nested properties.
 * Array indexing is supported using bracket notation: `$[index]` or `$[#-N]` for negative indexing.
 *
 * @example
 * ```typescript
 * '$.name'                    // Top-level field
 * '$.profile.bio'             // Nested field
 * '$.tags[0]'                 // Array element by index
 * '$.tags[#-1]'               // Last array element
 * '$.profile.settings.theme'  // Deeply nested field
 * ```
 */
export type JsonPath = `$.${string}`

/**
 * Extracts all valid property paths from a document type.
 *
 * @typeParam T - The document type
 *
 * @remarks
 * Generates a union type of all possible paths through the document structure,
 * including nested properties. Uses type-fest's `Paths` utility internally.
 *
 * @example
 * ```typescript
 * interface User extends Document {
 *   name: string;
 *   profile: {
 *     bio: string;
 *     settings: {
 *       theme: 'light' | 'dark';
 *     };
 *   };
 * }
 *
 * // DocumentPath<User> produces:
 * // 'name' | 'profile' | 'profile.bio' | 'profile.settings' | 'profile.settings.theme'
 * ```
 */
export type DocumentPath<T> = Paths<T>

/** String field names accepted by checked schema declarations. */
export type SchemaFieldName<T> = Extract<keyof T | DocumentPath<T>, string>

/**
 * Gets the type at a specific document path.
 *
 * @typeParam T - The document type
 * @typeParam P - The path string (must be a valid path in T)
 *
 * @remarks
 * Extracts the TypeScript type of the value at the given path.
 * Uses type-fest's `Get` utility internally.
 * Provides compile-time type safety for nested property access.
 *
 * @example
 * ```typescript
 * interface User extends Document {
 *   name: string;
 *   profile: {
 *     settings: {
 *       theme: 'light' | 'dark';
 *     };
 *   };
 * }
 *
 * type ThemeType = PathValue<User, 'profile.settings.theme'>;  // 'light' | 'dark'
 * type NameType = PathValue<User, 'name'>;  // string
 * type ProfileType = PathValue<User, 'profile'>;  // { settings: { theme: 'light' | 'dark' } }
 *
 * // Compiler errors for invalid paths:
 * // type Invalid = PathValue<User, 'profile.nonexistent'>;  // Error: Property doesn't exist
 * // type WrongType = PathValue<User, 'name'> extends number ? number : never;  // Error: string is not number
 * ```
 */
export type PathValue<T, P extends string> = Get<T, P>
