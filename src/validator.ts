import { ValidationError } from "./errors.js"
import type { StandardSchemaV1 } from "./standard-schema.js"

/**
 * Creates a type predicate validator from a Standard Schema compatible validator.
 *
 * @typeParam T - The document type being validated
 *
 * @param schema - A Standard Schema v1 compatible schema (Zod, Valibot, ArkType, etc.)
 * @returns A type predicate function for use with StrataDB schemas
 *
 * @remarks
 * This wrapper integrates Standard Schema-compatible validators (Zod, Valibot, ArkType, etc.)
 * with StrataDB's validation system. It converts Standard Schema validation failures into
 * StrataDB's ValidationError type with proper field and value context.
 *
 * **Key Features:**
 * - Accepts any Standard Schema v1 compatible validator
 * - Converts validation failures to ValidationError with detailed context
 * - Extracts field paths from Standard Schema issue objects
 * - Returns type predicate function `(doc: unknown) => doc is T`
 * - Only supports synchronous validation (throws if schema returns Promise)
 *
 * **Standard Schema Support:**
 * The wrapper checks for the `~standard` property with version 1. Compatible libraries include:
 * - Zod v3.23+
 * - Valibot v0.31+
 * - ArkType v2.0+
 * - And any other library implementing Standard Schema v1
 *
 * @throws {ValidationError} If the schema validator returns a Promise (async validation not supported) or if validation fails
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { createSchema, wrapStandardSchema, type Document } from 'stratadb';
 *
 * // Define document type
 * type User = Document<{
 *   name: string;
 *   email: string;
 *   age: number;
 * }>;
 *
 * // ✅ Using Zod validator
 * const UserZodSchema = z.object({
 *   id: z.string(),
 *   name: z.string().min(1),
 *   email: z.string().email(),
 *   age: z.number().int().min(0)
 * });
 *
 * const userSchema = createSchema<User>()
 *   .field('name', { type: 'TEXT', indexed: true })
 *   .field('email', { type: 'TEXT', indexed: true, unique: true })
 *   .field('age', { type: 'INTEGER', indexed: true })
 *   .validate(wrapStandardSchema<User>(UserZodSchema))
 *   .build();
 *
 * // ✅ Using Valibot validator
 * import * as v from 'valibot';
 *
 * const UserValibotSchema = v.object({
 *   id: v.string(),
 *   name: v.pipe(v.string(), v.minLength(1)),
 *   email: v.pipe(v.string(), v.email()),
 *   age: v.pipe(v.number(), v.integer(), v.minValue(0))
 * });
 *
 * const userSchema2 = createSchema<User>()
 *   .field('name', { type: 'TEXT', indexed: true })
 *   .validate(wrapStandardSchema<User>(UserValibotSchema))
 *   .build();
 *
 * // ✅ Using ArkType validator
 * import { type } from 'arktype';
 *
 * const UserArkSchema = type({
 *   id: 'string',
 *   name: 'string>0',
 *   email: 'string.email',
 *   age: 'integer>=0'
 * });
 *
 * const userSchema3 = createSchema<User>()
 *   .field('name', { type: 'TEXT', indexed: true })
 *   .validate(wrapStandardSchema<User>(UserArkSchema))
 *   .build();
 *
 * // Validation errors are converted to StrataDB ValidationError
 * try {
 *   await users.insertOne({ name: '', email: 'invalid', age: -5 });
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     console.log(error.field);  // 'email'
 *     console.log(error.value);  // 'invalid'
 *     console.log(error.message); // 'Validation failed for field "email": Invalid email'
 *   }
 * }
 * ```
 */
export function wrapStandardSchema<T>(
  schema: StandardSchemaV1<unknown, T>
): (doc: unknown) => doc is T {
  return (doc: unknown): doc is T => {
    // Call the Standard Schema validate function
    const result = schema["~standard"].validate(doc)

    // StrataDB only supports synchronous validation
    if (result instanceof Promise) {
      throw new ValidationError(
        "Async validation is not supported: Standard Schema validators must return synchronous results. " +
          "StrataDB requires immediate validation responses for performance and consistency.",
        undefined,
        doc
      )
    }

    // If validation succeeded, return true (type predicate)
    if (result.issues === undefined) {
      return true
    }

    // Validation failed - convert Standard Schema issues to ValidationError
    // Take the first issue for the ValidationError
    const [firstIssue] = result.issues

    if (!firstIssue) {
      throw new ValidationError(
        "Validation failed with no specific issues",
        "unknown",
        doc
      )
    }

    // Extract field path from Standard Schema issue
    const field = extractFieldPath(firstIssue.path)

    // Extract value at the field path if possible
    const value = extractValueAtPath(doc, firstIssue.path)

    // Throw ValidationError with field and value context
    throw new ValidationError(firstIssue.message, field, value)
  }
}

/**
 * Extracts a field path string from Standard Schema issue path.
 *
 * @param path - The path array from Standard Schema issue
 * @returns A string representation of the field path
 *
 * @internal
 */
function extractFieldPath(
  path: ReadonlyArray<PropertyKey | StandardSchemaV1.PathSegment> | undefined
): string {
  if (!path || path.length === 0) {
    return "unknown"
  }

  return path
    .map((segment) => {
      // Check if segment is a PathSegment object with key property
      // biome-ignore lint/suspicious/noUnnecessaryConditions: external Standard Schema implementations can supply malformed null segments
      if (typeof segment === "object" && segment !== null && "key" in segment) {
        return String(segment.key)
      }
      // Otherwise it's a PropertyKey (string | number | symbol)
      return String(segment)
    })
    .join(".")
}

/**
 * Extracts the value at the specified path from a document.
 *
 * @param doc - The document to extract from
 * @param path - The path array from Standard Schema issue
 * @returns The value at the path, or the entire document if path is unavailable
 *
 * @internal
 */
function extractValueAtPath(
  doc: unknown,
  path: ReadonlyArray<PropertyKey | StandardSchemaV1.PathSegment> | undefined
): unknown {
  if (!path || path.length === 0) {
    return doc
  }

  let current: unknown = doc

  for (const segment of path) {
    // Get the key from segment
    const key =
      // biome-ignore lint/suspicious/noUnnecessaryConditions: retain runtime null guard for external validator input
      typeof segment === "object" && segment !== null && "key" in segment
        ? segment.key
        : segment

    // Navigate to the next level
    if (
      current !== null &&
      current !== undefined &&
      typeof current === "object"
    ) {
      current = (current as Record<PropertyKey, unknown>)[key]
    } else {
      // Cannot navigate further
      return current
    }
  }

  return current
}
