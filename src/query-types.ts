import type { Simplify } from "type-fest"
import type { DocumentPath, PathValue } from "./path-types.js"

/**
 * Type-safe comparison operators for document queries.
 *
 * @remarks
 * These operators provide MongoDB-like query capabilities while maintaining
 * strict TypeScript type safety. Each operator is constrained to work only
 * with appropriate data types, preventing runtime errors from invalid comparisons.
 *
 * The comparison operators include:
 * - Equality: `$eq`, `$ne`
 * - Ordering: `$gt`, `$gte`, `$lt`, `$lte` (numbers and dates only)
 * - Membership: `$in`, `$nin` (arrays of values)
 *
 * @example
 * ```typescript
 * // ✅ Valid usage
 * const numberQuery: ComparisonOperator<number> = {
 *   $eq: 42,
 *   $gt: 18,
 *   $in: [1, 2, 3]
 * };
 *
 * const dateQuery: ComparisonOperator<Date> = {
 *   $gte: new Date('2023-01-01'),
 *   $lt: new Date('2024-01-01')
 * };
 *
 * const stringQuery: ComparisonOperator<string> = {
 *   $eq: 'hello',
 *   $ne: 'world',
 *   $in: ['a', 'b', 'c']
 * };
 *
 * // ❌ TypeScript errors - invalid operators
 * const invalidQuery: ComparisonOperator<string> = {
 *   $gt: 'greater',  // Error: $gt not available for strings
 *   $lt: 'less'      // Error: $lt not available for strings
 * };
 *
 * // Usage in queries
 * const users = await db.find({
 *   age: { $gt: 18, $lt: 65 },           // Number range query
 *   status: { $in: ['active', 'pending'] }, // String membership query
 *   createdAt: { $gte: startDate }      // Date range query
 * });
 * ```
 */

/**
 * Ordering comparison operators (greater than, less than).
 *
 * @remarks
 * These operators are only available for types that support natural ordering:
 * numbers and dates. This prevents nonsensical comparisons like checking if
 * one string is "greater than" another string.
 *
 * @typeParam T - The field type (must be number or Date)
 */
export type OrderingOperators<T> = T extends number | Date
  ? {
      /** Greater than the specified value */
      readonly $gt?: T

      /** Greater than or equal to the specified value */
      readonly $gte?: T

      /** Less than the specified value */
      readonly $lt?: T

      /** Less than or equal to the specified value */
      readonly $lte?: T
    }
  : never

/**
 * Equality comparison operators.
 *
 * @remarks
 * These operators work with all data types and provide basic equality/inequality checks.
 *
 * @typeParam T - The field type
 */
export type EqualityOperators<T> = {
  /** Equal to the specified value */
  readonly $eq?: T

  /** Not equal to the specified value */
  readonly $ne?: T
}

/**
 * Membership comparison operators.
 *
 * @remarks
 * These operators check if a value is included in or excluded from a set of values.
 * The array type is enforced to match the field type for type safety.
 *
 * @typeParam T - The field type
 */
export type MembershipOperators<T> = {
  /** Value is included in the specified array */
  readonly $in?: readonly T[]

  /** Value is not included in the specified array */
  readonly $nin?: readonly T[]
}

export type ComparisonOperator<T> = T extends number | Date
  ? EqualityOperators<T> & OrderingOperators<T> & MembershipOperators<T>
  : EqualityOperators<T> & MembershipOperators<T>

/**
 * String-specific query operators for pattern matching.
 *
 * @remarks
 * These operators provide MongoDB-like string matching capabilities with full
 * type safety. Only available for string fields to prevent runtime errors.
 *
 * For complex pattern matching that would typically use regular expressions,
 * consider using these alternatives:
 * - `$like`: For SQL-style pattern matching with % wildcards (case-sensitive)
 * - `$ilike`: For SQL-style patterns with ASCII case folding
 * - `$contains`: For case-sensitive literal substring containment
 * - `$startsWith`: For case-sensitive literal prefix matching
 * - `$endsWith`: For case-sensitive literal suffix matching
 *
 * @example
 * ```typescript
 * // ✅ Valid string queries
 * const emailQuery: StringOperator = {
 *   $like: '%@example.com',     // SQL LIKE pattern (case-sensitive)
 *   $startsWith: 'admin',      // Starts with prefix
 *   $endsWith: '@domain.com'   // Ends with suffix
 * };
 *
 * // ✅ Case-insensitive pattern matching
 * const caseInsensitiveQuery: StringOperator = {
 *   $ilike: '%alice%'          // Matches 'Alice', 'ALICE', 'alice', etc.
 * };
 *
 * // ✅ Literal substring containment
 * const containsQuery: StringOperator = {
 *   $contains: 'admin'         // Equivalent to: $like: '%admin%'
 * };
 *
 * // ✅ Pattern matching alternatives
 * const namePatterns: StringOperator = {
 *   $startsWith: 'A',          // Names starting with 'A'
 *   $endsWith: 'son',          // Names ending with 'son'
 *   $contains: 'john'          // Contains 'john' anywhere
 * };
 *
 * // ✅ Combining multiple string conditions
 * const complexStringQuery: StringOperator = {
 *   $startsWith: 'Dr.',
 *   $ilike: '%phd%'            // Case-insensitive search for 'PhD'
 * };
 * ```
 */
export type StringOperator = {
  /** JavaScript Unicode regex string, case-sensitive and non-indexable. */
  readonly $regex?: string
  /** SQL-style LIKE pattern matching (case-sensitive) */
  readonly $like?: string

  /**
   * SQL-style LIKE pattern matching (case-insensitive).
   *
   * @remarks
   * The `$ilike` operator performs case-insensitive pattern matching using
   * ASCII case folding. Use the same `%` and `_` wildcards as `$like`:
   * - `%` matches zero or more characters
   * - `_` matches exactly one character
   *
   * This is particularly useful for user-facing search features where users
   * expect case-insensitive matching.
   *
   * @example
   * ```typescript
   * // Find users with name containing 'alice' (any case)
   * const users = await collection.find({
   *   name: { $ilike: '%alice%' }
   * });
   * // Matches: 'Alice Smith', 'ALICE', 'alice jones', 'AlIcE'
   *
   * // Case-insensitive email domain search
   * const gmailUsers = await collection.find({
   *   email: { $ilike: '%@gmail.com' }
   * });
   * // Matches: 'user@Gmail.com', 'USER@GMAIL.COM', 'user@gmail.com'
   * ```
   */
  readonly $ilike?: string

  /**
   * Substring containment check (case-sensitive).
   *
   * @remarks
   * Checks for a literal substring with exact case. Percent, underscore and
   * backslash are ordinary characters; the translator uses SQLite instr().
   *
   * For case-insensitive containment checks, combine with `$ilike`:
   * `{ field: { $ilike: '%value%' } }`
   *
   * @example
   * ```typescript
   * // Find documents where description contains 'important'
   * const docs = await collection.find({
   *   description: { $contains: 'important' }
   * });
   * // Equivalent to: { description: { $like: '%important%' } }
   *
   * // Find users with a specific domain in their email
   * const users = await collection.find({
   *   email: { $contains: '@example' }
   * });
   * // Matches: 'user@example.com', 'admin@example.org'
   * // Does NOT match: 'user@Example.com' (case-sensitive)
   *
   * // Combine with other string operators
   * const filtered = await collection.find({
   *   title: { $contains: 'guide', $startsWith: 'TypeScript' }
   * });
   * ```
   */
  readonly $contains?: string

  /** String starts with the specified prefix */
  readonly $startsWith?: string

  /** String ends with the specified suffix */
  readonly $endsWith?: string
}

/**
 * Array-specific query operators for MongoDB-like array operations.
 *
 * @typeParam T - The field type (must be an array)
 *
 * @remarks
 * These operators provide powerful array querying capabilities with type safety.
 * The array element type is automatically inferred using conditional type inference.
 * Only available for array types to prevent runtime errors.
 *
 * @example
 * ```typescript
 * // Array field type
 * type User = Document<{
 *   tags: string[];
 *   scores: number[];
 *   contacts: { name: string; email: string; }[];
 * }>;
 *
 * // ✅ Valid array queries
 * const tagsQuery: ArrayOperator<User['tags']> = {
 *   $all: ['developer', 'typescript'],  // Contains all specified values
 *   $size: 3,                           // Exactly 3 elements
 *   $index: 0                           // First element equals 'admin'
 * };
 *
 * const scoresQuery: ArrayOperator<User['scores']> = {
 *   $all: [90, 95, 100],
 *   $size: 5
 * };
 *
 * // Nested object array query
 * const contactsQuery: ArrayOperator<User['contacts']> = {
 *   $elemMatch: {
 *     name: 'Alice',
 *     email: { $endsWith: '@example.com' }
 *   }
 * };
 *
 * // ❌ TypeScript errors
 * const invalidQuery: ArrayOperator<User['name']> = {
 *   $all: ['value']  // Error: User['name'] is string, not array
 * };
 * ```
 */
export type ArrayOperator<T> = T extends readonly (infer U)[]
  ? {
      /** Array contains all specified values (order doesn't matter) */
      readonly $all?: readonly U[]

      /** Array has exactly the specified number of elements */
      readonly $size?: number

      /** Array element at specified index matches (0-based or negative) */
      readonly $index?: number

      /** At least one array element matches the nested query filter */
      readonly $elemMatch?: QueryFilter<U>
    }
  : never

/**
 * Existence operators for checking field presence.
 *
 * @remarks
 * Allows checking whether a field exists in a document, regardless of its value.
 * This is useful for distinguishing between missing fields and fields with null values.
 *
 * @example
 * ```typescript
 * // Check if field exists (even if null)
 * const hasEmail = { email: { $exists: true } };
 *
 * // Check if field is missing
 * const noPhone = { phone: { $exists: false } };
 *
 * // Combined with other operators
 * const activeUsersWithEmail = {
 *   status: 'active',
 *   email: { $exists: true, $ne: null }
 * };
 * ```
 */
export type ExistenceOperator = {
  /** Field exists in document (true) or doesn't exist (false) */
  readonly $exists?: boolean
}

/**
 * Combined field operators for any field type.
 *
 * @typeParam T - The field type
 *
 * @remarks
 * Combines all applicable operator types for a field. Uses conditional types
 * to only provide operators that make sense for the specific field type.
 *
 * @example
 * ```typescript
 * type User = Document<{
 *   name: string;
 *   age: number;
 *   tags: string[];
 *   active: boolean;
 *   createdAt: Date;
 * }>;
 *
 * // String field gets string operators
 * const nameField: FieldOperator<User['name']> = {
 *   $eq: 'Alice',
 *   $like: '%admin%',
 *   $startsWith: 'A'
 * };
 *
 * // Number field gets comparison operators
 * const ageField: FieldOperator<User['age']> = {
 *   $gt: 18,
 *   $lte: 65
 * };
 *
 * // Array field gets array operators
 * const tagsField: FieldOperator<User['tags']> = {
 *   $all: ['developer', 'typescript'],
 *   $size: 3
 * };
 *
 * // Boolean field only gets basic operators
 * const activeField: FieldOperator<User['active']> = {
 *   $eq: true,
 *   $ne: false
 * };
 * ```
 */
export type FieldOperator<T> = T extends string
  ? ComparisonOperator<T> & StringOperator & ExistenceOperator
  : T extends readonly unknown[]
    ? ComparisonOperator<T> & ArrayOperator<T> & ExistenceOperator
    : ComparisonOperator<T> & ExistenceOperator

/**
 * Logical operators for complex query composition.
 *
 * @typeParam T - The document type being queried
 *
 * @remarks
 * Logical operators enable sophisticated query logic by combining multiple conditions.
 * These operators mirror MongoDB's logical query operators while maintaining full type safety.
 *
 * All logical operators support recursive composition, allowing unlimited nesting depth
 * for complex business logic requirements.
 *
 * @example
 * ```typescript
 * type User = Document<{
 *   name: string;
 *   age: number;
 *   status: 'active' | 'inactive' | 'pending';
 *   email: string;
 * }>;
 *
 * // ✅ AND - All conditions must match
 * const activeAdults: LogicalOperator<User> = {
 *   $and: [
 *     { age: { $gte: 18 } },
 *     { status: 'active' }
 *   ]
 * };
 *
 * // ✅ OR - At least one condition must match
 * const adminOrModerator: LogicalOperator<User> = {
 *   $or: [
 *     { name: { $startsWith: 'admin' } },
 *     { status: 'active' }
 *   ]
 * };
 *
 * // ✅ NOR - None of the conditions must match
 * const notInactiveOrPending: LogicalOperator<User> = {
 *   $nor: [
 *     { status: 'inactive' },
 *     { status: 'pending' }
 *   ]
 * };
 *
 * // ✅ NOT - Negates a single condition
 * const notAdult: LogicalOperator<User> = {
 *   $not: { age: { $gte: 18 } }
 * };
 *
 * // ✅ Complex nested queries
 * const complexQuery: LogicalOperator<User> = {
 *   $and: [
 *     {
 *       $or: [
 *         { age: { $gt: 18 } },
 *         { status: 'active' }
 *       ]
 *     },
 *     {
 *       $not: { email: { $endsWith: '@spam.com' } }
 *     }
 *   ]
 * };
 * ```
 */
export type LogicalOperator<T> = {
  /** All conditions in the array must match (logical AND) */
  readonly $and?: readonly QueryFilter<T>[]

  /** At least one condition in the array must match (logical OR) */
  readonly $or?: readonly QueryFilter<T>[]

  /** None of the conditions in the array must match (logical NOR) */
  readonly $nor?: readonly QueryFilter<T>[]

  /** Negates the given condition (logical NOT) */
  readonly $not?: QueryFilter<T>
}

/**
 * Complete query filter combining field filters and logical operators.
 *
 * @typeParam T - The document type being queried
 *
 * @remarks
 * QueryFilter is the root type for all database queries in StrataDB. It combines:
 * - Direct field matching (e.g., `{ name: 'Alice' }`)
 * - Field operators (e.g., `{ age: { $gt: 18 } }`)
 * - Logical operators (e.g., `{ $and: [...] }`)
 * - Nested path queries (e.g., `{ 'profile.bio': 'Software engineer' }`)
 *
 * This type is fully recursive, allowing unlimited query complexity while
 * maintaining complete type safety at compile time. The Simplify wrapper
 * ensures clean IDE hover displays for complex query types.
 *
 * @example
 * ```typescript
 * type User = Document<{
 *   name: string;
 *   age: number;
 *   email: string;
 *   tags: string[];
 *   status: 'active' | 'inactive';
 *   createdAt: Date;
 *   profile: {
 *     bio: string;
 *     settings: {
 *       theme: 'light' | 'dark';
 *     };
 *   };
 * }>;
 *
 * // ✅ Simple field matching
 * const simpleQuery: QueryFilter<User> = {
 *   name: 'Alice'
 * };
 *
 * // ✅ Field operators
 * const operatorQuery: QueryFilter<User> = {
 *   age: { $gt: 18, $lte: 65 },
 *   email: { $endsWith: '@example.com' }
 * };
 *
 * // ✅ Nested path queries (dot notation)
 * const nestedQuery: QueryFilter<User> = {
 *   'profile.bio': 'Software engineer',
 *   'profile.settings.theme': 'dark'
 * };
 *
 * // ✅ Nested paths with operators
 * const nestedOperatorQuery: QueryFilter<User> = {
 *   'profile.bio': { $like: '%engineer%' },
 *   'profile.settings.theme': { $in: ['light', 'dark'] }
 * };
 *
 * // ✅ Logical operators
 * const logicalQuery: QueryFilter<User> = {
 *   $and: [
 *     { age: { $gte: 18 } },
 *     { status: 'active' }
 *   ]
 * };
 *
 * // ✅ Mixed queries
 * const mixedQuery: QueryFilter<User> = {
 *   status: 'active',
 *   $or: [
 *     { age: { $lt: 25 } },
 *     { tags: { $in: ['premium', 'vip'] } }
 *   ]
 * };
 *
 * // ✅ Complex nested queries
 * const complexQuery: QueryFilter<User> = {
 *   $and: [
 *     {
 *       $or: [
 *         { age: { $gt: 18, $lt: 65 } },
 *         { status: 'active' }
 *       ]
 *     },
 *     {
 *       $not: {
 *         email: { $endsWith: '@spam.com' }
 *       }
 *     },
 *     {
 *       tags: { $all: ['verified', 'active'] }
 *     },
 *     {
 *       'profile.settings.theme': 'dark'
 *     }
 *   ]
 * };
 *
 * // ✅ Array element matching
 * const arrayQuery: QueryFilter<User> = {
 *   tags: {
 *     $elemMatch: {
 *       // This recursively uses QueryFilter for array elements
 *       $startsWith: 'premium'
 *     }
 *   }
 * };
 *
 * // Usage with collection
 * const results = await users.find(complexQuery);
 * ```
 */
export type QueryFilter<T> = Simplify<
  | LogicalOperator<T>
  | {
      [K in keyof T]?: T[K] | FieldOperator<T[K]>
    }
  | {
      [P in DocumentPath<T> as P extends string ? P : never]?: P extends string
        ? PathValue<T, P> | FieldOperator<PathValue<T, P>>
        : never
    }
>
