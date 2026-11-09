/**
 * Unit tests for $ilike and $contains string operators.
 *
 * @remarks
 * These tests verify that the SQLiteQueryTranslator correctly translates
 * the new string operators ($ilike and $contains) to SQL.
 */

import { beforeEach, describe, expect, it } from "bun:test"
import type { Document, QueryFilter } from "../../src/index"
import { createSchema } from "../../src/schema-builder"
import { SQLiteQueryTranslator } from "../../src/sqlite-query-translator"

// ============================================================================
// TEST SCHEMAS AND TYPES
// ============================================================================

/**
 * User document type for testing string operators.
 */
type User = Document<{
  readonly name: string
  readonly email: string
  readonly description: string
  readonly status: "active" | "inactive" | "pending"
}>

/**
 * Test schema with indexed and non-indexed string fields.
 */
const userSchema = createSchema<User>()
  .field("name", { type: "TEXT", indexed: true })
  .field("email", { type: "TEXT", indexed: true })
  .field("description", { type: "TEXT", indexed: false })
  .field("status", { type: "TEXT", indexed: false })
  .build()

let translator: SQLiteQueryTranslator<User>

beforeEach(() => {
  translator = new SQLiteQueryTranslator(userSchema)
})

// ============================================================================
// $ILIKE OPERATOR TESTS
// ============================================================================

describe("SQLiteQueryTranslator - $ilike Operator", () => {
  /**
   * Tests for case-insensitive LIKE pattern matching.
   */

  it("should translate $ilike to LIKE ? COLLATE NOCASE for indexed field", () => {
    const filter: QueryFilter<User> = { name: { $ilike: "%alice%" } }
    const result = translator.translate(filter)

    expect(result.sql).toBe('("_name" LIKE ? COLLATE NOCASE)')
    expect(result.params).toEqual(["%alice%"])
  })

  it("should translate $ilike to LIKE ? COLLATE NOCASE for non-indexed field", () => {
    const filter: QueryFilter<User> = { description: { $ilike: "%important%" } }
    const result = translator.translate(filter)

    expect(result.sql).toBe("(jsonb_extract(body, ?) LIKE ? COLLATE NOCASE)")
    expect(result.params).toEqual(["$.description", "%important%"])
  })

  it("should preserve pattern as-is in params for $ilike", () => {
    const filter: QueryFilter<User> = { email: { $ilike: "%@GMAIL.COM" } }
    const result = translator.translate(filter)

    expect(result.sql).toBe('("_email" LIKE ? COLLATE NOCASE)')
    expect(result.params).toEqual(["%@GMAIL.COM"])
  })

  it("should handle $ilike with underscore wildcard", () => {
    const filter: QueryFilter<User> = { name: { $ilike: "A_ice" } }
    const result = translator.translate(filter)

    expect(result.sql).toBe('("_name" LIKE ? COLLATE NOCASE)')
    expect(result.params).toEqual(["A_ice"])
  })

  it("should handle $ilike with exact pattern (no wildcards)", () => {
    const filter: QueryFilter<User> = { name: { $ilike: "Alice" } }
    const result = translator.translate(filter)

    expect(result.sql).toBe('("_name" LIKE ? COLLATE NOCASE)')
    expect(result.params).toEqual(["Alice"])
  })
})

// ============================================================================
// $CONTAINS OPERATOR TESTS
// ============================================================================

describe("SQLiteQueryTranslator - $contains Operator", () => {
  /**
   * Tests for substring containment operator.
   */

  it("should translate $contains to LIKE ? with wrapped value for indexed field", () => {
    const filter: QueryFilter<User> = { name: { $contains: "admin" } }
    const result = translator.translate(filter)

    expect(result.sql).toBe('("_name" LIKE ?)')
    expect(result.params).toEqual(["%admin%"])
  })

  it("should translate $contains to LIKE ? with wrapped value for non-indexed field", () => {
    const filter: QueryFilter<User> = {
      description: { $contains: "important" },
    }
    const result = translator.translate(filter)

    expect(result.sql).toBe("(jsonb_extract(body, ?) LIKE ?)")
    expect(result.params).toEqual(["$.description", "%important%"])
  })

  it("should wrap value with % on both sides for $contains", () => {
    const filter: QueryFilter<User> = { email: { $contains: "@example" } }
    const result = translator.translate(filter)

    expect(result.sql).toBe('("_email" LIKE ?)')
    expect(result.params).toEqual(["%@example%"])
  })

  it("should handle $contains with special characters", () => {
    const filter: QueryFilter<User> = { description: { $contains: "foo.bar" } }
    const result = translator.translate(filter)

    expect(result.sql).toBe("(jsonb_extract(body, ?) LIKE ?)")
    expect(result.params).toEqual(["$.description", "%foo.bar%"])
  })

  it("should handle $contains with empty string", () => {
    const filter: QueryFilter<User> = { name: { $contains: "" } }
    const result = translator.translate(filter)

    expect(result.sql).toBe('("_name" LIKE ?)')
    expect(result.params).toEqual(["%%"])
  })
})

// ============================================================================
// COMBINING OPERATORS TESTS
// ============================================================================

describe("SQLiteQueryTranslator - Combined String Operators", () => {
  /**
   * Tests for combining $ilike and $contains with other operators.
   */

  it("should combine $ilike with $startsWith", () => {
    const filter: QueryFilter<User> = {
      name: { $ilike: "%smith%", $startsWith: "Dr." },
    }
    const result = translator.translate(filter)

    expect(result.sql).toBe(
      '("_name" LIKE ? COLLATE NOCASE AND "_name" LIKE ?)'
    )
    expect(result.params).toEqual(["%smith%", "Dr.%"])
  })

  it("should combine $contains with $endsWith", () => {
    const filter: QueryFilter<User> = {
      email: { $contains: "admin", $endsWith: ".com" },
    }
    const result = translator.translate(filter)

    expect(result.sql).toBe('("_email" LIKE ? AND "_email" LIKE ?)')
    expect(result.params).toEqual(["%admin%", "%.com"])
  })

  it("should combine $ilike with $eq", () => {
    const filter: QueryFilter<User> = {
      $and: [{ name: { $ilike: "%alice%" } }, { status: "active" }],
    }
    const result = translator.translate(filter)

    expect(result.sql).toBe(
      '(("_name" LIKE ? COLLATE NOCASE) AND jsonb_extract(body, ?) = ?)'
    )
    expect(result.params).toEqual(["%alice%", "$.status", "active"])
  })

  it("should combine $contains with $ne", () => {
    const filter: QueryFilter<User> = {
      $and: [
        { description: { $contains: "urgent" } },
        { status: { $ne: "inactive" } },
      ],
    }
    const result = translator.translate(filter)

    expect(result.sql).toBe(
      "((jsonb_extract(body, ?) LIKE ?) AND ((jsonb_extract(body, ?) IS NULL OR jsonb_extract(body, ?) != ?)))"
    )
    expect(result.params).toEqual([
      "$.description",
      "%urgent%",
      "$.status",
      "$.status",
      "inactive",
    ])
  })

  it("should combine $ilike with $in", () => {
    const filter: QueryFilter<User> = {
      name: { $ilike: "%test%" },
      status: { $in: ["active", "pending"] },
    }
    const result = translator.translate(filter)

    expect(result.sql).toBe(
      '("_name" LIKE ? COLLATE NOCASE) AND (jsonb_extract(body, ?) IN (?, ?))'
    )
    expect(result.params).toEqual(["%test%", "$.status", "active", "pending"])
  })

  it("should use $ilike in $or condition", () => {
    const filter: QueryFilter<User> = {
      $or: [{ name: { $ilike: "%alice%" } }, { email: { $ilike: "%alice%" } }],
    }
    const result = translator.translate(filter)

    expect(result.sql).toBe(
      '(("_name" LIKE ? COLLATE NOCASE) OR ("_email" LIKE ? COLLATE NOCASE))'
    )
    expect(result.params).toEqual(["%alice%", "%alice%"])
  })

  it("should use $contains in $or condition", () => {
    const filter: QueryFilter<User> = {
      $or: [
        { name: { $contains: "admin" } },
        { description: { $contains: "admin" } },
      ],
    }
    const result = translator.translate(filter)

    expect(result.sql).toBe(
      '(("_name" LIKE ?) OR (jsonb_extract(body, ?) LIKE ?))'
    )
    expect(result.params).toEqual(["%admin%", "$.description", "%admin%"])
  })

  it("should use $ilike with $not", () => {
    const filter: QueryFilter<User> = {
      $not: { name: { $ilike: "%test%" } },
    }
    const result = translator.translate(filter)

    expect(result.sql).toBe('NOT (("_name" LIKE ? COLLATE NOCASE))')
    expect(result.params).toEqual(["%test%"])
  })

  it("should use $contains with $not", () => {
    const filter: QueryFilter<User> = {
      $not: { email: { $contains: "spam" } },
    }
    const result = translator.translate(filter)

    expect(result.sql).toBe('NOT (("_email" LIKE ?))')
    expect(result.params).toEqual(["%spam%"])
  })
})

// ============================================================================
// EDGE CASES
// ============================================================================

describe("SQLiteQueryTranslator - String Operators Edge Cases", () => {
  /**
   * Tests for edge cases with $ilike and $contains.
   */

  it("should handle $ilike with percent literal (escaped by user)", () => {
    // Note: Users need to escape % as %% if they want literal %
    const filter: QueryFilter<User> = { name: { $ilike: "100%%" } }
    const result = translator.translate(filter)

    expect(result.sql).toBe('("_name" LIKE ? COLLATE NOCASE)')
    expect(result.params).toEqual(["100%%"])
  })

  it("should handle $contains with value containing %", () => {
    // The % in the value becomes part of the pattern
    const filter: QueryFilter<User> = { description: { $contains: "50%" } }
    const result = translator.translate(filter)

    expect(result.sql).toBe("(jsonb_extract(body, ?) LIKE ?)")
    expect(result.params).toEqual(["$.description", "%50%%"])
  })

  it("should handle multiple fields with different string operators", () => {
    const filter: QueryFilter<User> = {
      name: { $ilike: "%alice%" },
      email: { $contains: "example" },
      description: { $like: "Important%" },
    }
    const result = translator.translate(filter)

    expect(result.sql).toBe(
      '("_name" LIKE ? COLLATE NOCASE) AND ("_email" LIKE ?) AND (jsonb_extract(body, ?) LIKE ?)'
    )
    expect(result.params).toEqual([
      "%alice%",
      "%example%",
      "$.description",
      "Important%",
    ])
  })
})
