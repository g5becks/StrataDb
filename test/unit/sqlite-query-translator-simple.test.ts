import { beforeEach, describe, expect, it } from "bun:test"
import type { Document, QueryFilter, QueryOptions } from "../../src/index"
import { createSchema } from "../../src/schema-builder"
import { SQLiteQueryTranslator } from "../../src/sqlite-query-translator"

// ============================================================================
// TOP-LEVEL REGEX CONSTANTS (required by linter for performance)
// ============================================================================

const SQL_LINE_REGEX = /^SQL:/
const PARAMS_LINE_REGEX = /^Parameters:/

// ============================================================================
// TEST SCHEMAS AND TYPES
// ============================================================================

/**
 * User document type for testing with mixed indexed and non-indexed fields.
 */
type User = Document<{
  readonly name: string
  readonly age: number
  readonly email: string
  readonly active: boolean
  readonly status: "active" | "inactive" | "pending"
  readonly tags: string[]
  readonly createdAt: Date
}>

/**
 * Test schema with mixed indexed and non-indexed fields.
 */
const userSchema = createSchema<User>()
  .field("name", { type: "TEXT", indexed: true })
  .field("age", { type: "INTEGER", indexed: true })
  .field("email", { type: "TEXT", indexed: true })
  .field("active", { type: "BOOLEAN", indexed: false })
  .field("status", { type: "TEXT", indexed: false })
  .field("tags", { type: "TEXT", indexed: false })
  .field("createdAt", { type: "INTEGER", indexed: false })
  .build()

let userTranslator: SQLiteQueryTranslator<User>

beforeEach(() => {
  userTranslator = new SQLiteQueryTranslator(userSchema)
})

// ============================================================================
// COMPARISON OPERATORS TESTS (AC #1)
// ============================================================================

describe("SQLiteQueryTranslator - Comparison Operators", () => {
  /**
   * AC #1: Tests verify comparison operators generate correct SQL with proper parameters.
   */

  it("should translate direct string equality for indexed field", () => {
    const filter: QueryFilter<User> = { name: "Alice" }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe('"_name" = ?')
    expect(result.params).toEqual(["Alice"])
  })

  it("should translate direct number equality for indexed field", () => {
    const filter: QueryFilter<User> = { age: 30 }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe('"_age" = ?')
    expect(result.params).toEqual([30])
  })

  it("should translate direct boolean equality for non-indexed field", () => {
    const filter: QueryFilter<User> = { active: true }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe("jsonb_extract(body, ?) = ?")
    expect(result.params).toEqual(["$.active", true])
  })

  it("should translate direct null equality", () => {
    const filter: QueryFilter<User> = { status: null }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe("jsonb_extract(body, ?) IS NULL")
    expect(result.params).toEqual(["$.status"])
  })

  it("should translate $eq operator", () => {
    const filter: QueryFilter<User> = { email: { $eq: "alice@example.com" } }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe('("_email" = ?)')
    expect(result.params).toEqual(["alice@example.com"])
  })

  it("should translate $ne operator", () => {
    const filter: QueryFilter<User> = { status: { $ne: "inactive" } }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe(
      "((jsonb_extract(body, ?) IS NULL OR jsonb_extract(body, ?) != ?))"
    )
    expect(result.params).toEqual(["$.status", "$.status", "inactive"])
  })

  it("should translate $gt operator", () => {
    const filter: QueryFilter<User> = { age: { $gt: 18 } }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe('("_age" > ?)')
    expect(result.params).toEqual([18])
  })

  it("should translate $gte operator", () => {
    const filter: QueryFilter<User> = { age: { $gte: 18 } }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe('("_age" >= ?)')
    expect(result.params).toEqual([18])
  })

  it("should translate $lt operator", () => {
    const filter: QueryFilter<User> = { age: { $lt: 65 } }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe('("_age" < ?)')
    expect(result.params).toEqual([65])
  })

  it("should translate $lte operator", () => {
    const filter: QueryFilter<User> = { age: { $lte: 65 } }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe('("_age" <= ?)')
    expect(result.params).toEqual([65])
  })

  it("should translate multiple operators combined with AND", () => {
    const filter: QueryFilter<User> = { age: { $gte: 18, $lt: 65 } }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe('("_age" >= ? AND "_age" < ?)')
    expect(result.params).toEqual([18, 65])
  })

  it("should translate $in operator", () => {
    const filter: QueryFilter<User> = { age: { $in: [18, 25, 30] } }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe('("_age" IN (?, ?, ?))')
    expect(result.params).toEqual([18, 25, 30])
  })

  it("should translate $nin operator", () => {
    const filter: QueryFilter<User> = {
      status: { $nin: ["inactive", "suspended"] },
    }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe(
      "((jsonb_extract(body, ?) IS NULL OR jsonb_extract(body, ?) NOT IN (?, ?)))"
    )
    expect(result.params).toEqual([
      "$.status",
      "$.status",
      "inactive",
      "suspended",
    ])
  })

  it("should handle empty $in array", () => {
    const filter: QueryFilter<User> = { age: { $in: [] } }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe("(0=1)")
    expect(result.params).toEqual([])
  })

  it("should handle empty $nin array", () => {
    const filter: QueryFilter<User> = { age: { $nin: [] } }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe("(1=1)")
    expect(result.params).toEqual([])
  })
})

// ============================================================================
// STRING OPERATORS TESTS (AC #2)
// ============================================================================

describe("SQLiteQueryTranslator - String Operators", () => {
  /**
   * AC #2: Tests verify string operators generate correct LIKE patterns.
   */

  it("should translate $like operator", () => {
    const filter: QueryFilter<User> = { name: { $like: "%admin%" } }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe('("_name" GLOB ?)')
    expect(result.params).toEqual(["*admin*"])
  })

  it("should translate $startsWith operator", () => {
    const filter: QueryFilter<User> = { name: { $startsWith: "Admin" } }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe('(substr("_name", 1, length(?)) = ?)')
    expect(result.params).toEqual(["Admin", "Admin"])
  })

  it("should translate $endsWith operator", () => {
    const filter: QueryFilter<User> = { email: { $endsWith: "@company.com" } }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe('(substr("_email", -length(?)) = ?)')
    expect(result.params).toEqual(["@company.com", "@company.com"])
  })
})

// ============================================================================
// ARRAY OPERATORS TESTS (AC #3)
// ============================================================================

describe("SQLiteQueryTranslator - Array Operators", () => {
  /**
   * AC #3: Tests verify array operators generate correct subqueries with jsonb_each.
   */

  it("should translate $all operator", () => {
    const filter: QueryFilter<User> = {
      tags: { $all: ["developer", "typescript"] },
    }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe(
      "((EXISTS (SELECT 1 FROM json_each(jsonb_extract(body, ?)) WHERE json_each.value = ?) AND EXISTS (SELECT 1 FROM json_each(jsonb_extract(body, ?)) WHERE json_each.value = ?)))"
    )
    expect(result.params).toEqual([
      "$.tags",
      "developer",
      "$.tags",
      "typescript",
    ])
  })

  it("should handle empty $all array", () => {
    const filter: QueryFilter<User> = { tags: { $all: [] } }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe("(1=1)")
    expect(result.params).toEqual([])
  })

  it("should translate $size operator", () => {
    const filter: QueryFilter<User> = { tags: { $size: 3 } }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe("(json_array_length(jsonb_extract(body, ?)) = ?)")
    expect(result.params).toEqual(["$.tags", 3])
  })

  it("should translate $size with zero", () => {
    const filter: QueryFilter<User> = { tags: { $size: 0 } }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe("(json_array_length(jsonb_extract(body, ?)) = ?)")
    expect(result.params).toEqual(["$.tags", 0])
  })
})

// ============================================================================
// LOGICAL OPERATORS TESTS (AC #4)
// ============================================================================

describe("SQLiteQueryTranslator - Logical Operators", () => {
  /**
   * AC #4: Tests verify logical operators generate correct AND/OR/NOT combinations with parentheses.
   */

  it("should translate $and with multiple conditions", () => {
    const filter: QueryFilter<User> = {
      $and: [{ age: { $gte: 18 } }, { active: true }, { status: "active" }],
    }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe(
      '(("_age" >= ?) AND jsonb_extract(body, ?) = ? AND jsonb_extract(body, ?) = ?)'
    )
    expect(result.params).toEqual([18, "$.active", true, "$.status", "active"])
  })

  it("should translate $or with multiple conditions", () => {
    const filter: QueryFilter<User> = {
      $or: [{ status: "active" }, { status: "pending" }, { active: true }],
    }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe(
      "(jsonb_extract(body, ?) = ? OR jsonb_extract(body, ?) = ? OR jsonb_extract(body, ?) = ?)"
    )
    expect(result.params).toEqual([
      "$.status",
      "active",
      "$.status",
      "pending",
      "$.active",
      true,
    ])
  })

  it("should translate $nor with multiple conditions", () => {
    const filter: QueryFilter<User> = {
      $nor: [{ status: "inactive" }, { active: false }],
    }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe(
      "NOT (jsonb_extract(body, ?) = ? OR jsonb_extract(body, ?) = ?)"
    )
    expect(result.params).toEqual(["$.status", "inactive", "$.active", false])
  })

  it("should translate $not with single condition", () => {
    const filter: QueryFilter<User> = {
      $not: { status: "inactive" },
    }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe("NOT (jsonb_extract(body, ?) = ?)")
    expect(result.params).toEqual(["$.status", "inactive"])
  })

  it("should translate $not with complex condition", () => {
    const filter: QueryFilter<User> = {
      $not: { age: { $gte: 18, $lt: 65 } },
    }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe('NOT (("_age" >= ? AND "_age" < ?))')
    expect(result.params).toEqual([18, 65])
  })

  it("should handle empty logical arrays", () => {
    const filter: QueryFilter<User> = { $and: [] }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe("1=1")
    expect(result.params).toEqual([])
  })
})

// ============================================================================
// NESTED QUERIES TESTS (AC #5)
// ============================================================================

describe("SQLiteQueryTranslator - Nested Queries", () => {
  /**
   * AC #5: Tests verify nested queries maintain correct precedence and parameter ordering.
   */

  it("should translate deeply nested queries", () => {
    const filter: QueryFilter<User> = {
      $and: [
        { name: { $ne: "System" } },
        {
          $or: [
            {
              $and: [{ age: { $gte: 18 } }, { age: { $lt: 65 } }],
            },
            {
              $not: { status: "suspended" },
            },
          ],
        },
      ],
    }
    const result = userTranslator.translate(filter)

    // Implementation wraps:
    // - Field operators consistently: (_field op ?)
    // - Logical operators: (condition1 OP condition2)
    // - NOT: NOT (condition) without extra outer parens
    // This ensures predictable SQL generation with proper precedence
    expect(result.sql).toBe(
      '((("_name" IS NULL OR "_name" != ?)) AND ((("_age" >= ?) AND ("_age" < ?)) OR NOT (jsonb_extract(body, ?) = ?)))'
    )
    expect(result.params).toEqual(["System", 18, 65, "$.status", "suspended"])
  })
})

// ============================================================================
// QUERY OPTIONS TESTS (AC #6)
// ============================================================================

describe("SQLiteQueryTranslator - Query Options", () => {
  /**
   * AC #6: Tests verify query options generate correct ORDER BY, LIMIT, OFFSET clauses.
   */

  it("should translate sort with single field", () => {
    const options: QueryOptions<User> = { sort: { name: 1 } }
    const result = userTranslator.translateOptions(options)

    expect(result.sql).toBe('ORDER BY "_name" ASC')
    expect(result.params).toEqual([])
  })

  it("should translate sort with multiple fields", () => {
    const options: QueryOptions<User> = {
      sort: { age: -1, name: 1, status: 1 },
    }
    const result = userTranslator.translateOptions(options)

    expect(result.sql).toBe(
      'ORDER BY "_age" DESC, "_name" ASC, jsonb_extract(body, ?) ASC'
    )
    expect(result.params).toEqual(["$.status"])
  })

  it("should translate non-indexed field sort", () => {
    const options: QueryOptions<User> = {
      sort: { status: 1, active: -1 },
    }
    const result = userTranslator.translateOptions(options)

    expect(result.sql).toBe(
      "ORDER BY jsonb_extract(body, ?) ASC, jsonb_extract(body, ?) DESC"
    )
    expect(result.params).toEqual(["$.status", "$.active"])
  })

  it("should translate limit option", () => {
    const options: QueryOptions<User> = { limit: 10 }
    const result = userTranslator.translateOptions(options)

    expect(result.sql).toBe("LIMIT ?")
    expect(result.params).toEqual([10])
  })

  it("should translate skip option", () => {
    const options: QueryOptions<User> = { skip: 20 }
    const result = userTranslator.translateOptions(options)

    expect(result.sql).toBe("OFFSET ?")
    expect(result.params).toEqual([20])
  })

  it("should translate both limit and skip", () => {
    const options: QueryOptions<User> = { limit: 10, skip: 20 }
    const result = userTranslator.translateOptions(options)

    expect(result.sql).toBe("LIMIT ? OFFSET ?")
    expect(result.params).toEqual([10, 20])
  })

  it("should translate sort with pagination", () => {
    const options: QueryOptions<User> = {
      sort: { age: -1, name: 1 },
      limit: 10,
      skip: 20,
    }
    const result = userTranslator.translateOptions(options)

    expect(result.sql).toBe(
      'ORDER BY "_age" DESC, "_name" ASC LIMIT ? OFFSET ?'
    )
    expect(result.params).toEqual([10, 20])
  })

  it("should handle empty options", () => {
    const options: QueryOptions<User> = {}
    const result = userTranslator.translateOptions(options)

    expect(result.sql).toBe("")
    expect(result.params).toEqual([])
  })
})

// ============================================================================
// EXISTENCE OPERATOR TESTS
// ============================================================================

describe("SQLiteQueryTranslator - Existence Operators", () => {
  it("should translate $exists: true", () => {
    const filter: QueryFilter<User> = { name: { $exists: true } }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe('(json_type("_name") IS NOT NULL)')
    expect(result.params).toEqual([])
  })

  it("should translate $exists: false", () => {
    const filter: QueryFilter<User> = { name: { $exists: false } }
    const result = userTranslator.translate(filter)

    expect(result.sql).toBe('(json_type("_name") IS NULL)')
    expect(result.params).toEqual([])
  })
})

// ============================================================================
// PARAMETER VALIDATION TESTS
// ============================================================================

describe("SQLiteQueryTranslator - Parameter Validation", () => {
  it("should handle valid SQLite bind values", () => {
    expect(() => userTranslator.translate({ name: "test" })).not.toThrow()
    expect(() => userTranslator.translate({ age: 42 })).not.toThrow()
    expect(() => userTranslator.translate({ active: true })).not.toThrow()
    expect(() => userTranslator.translate({ status: null })).not.toThrow()
  })
})

// ============================================================================
// TOSTRING() INTROSPECTION TESTS
// ============================================================================

describe("SQLiteQueryTranslator - toString() Query Introspection", () => {
  /**
   * Tests verify that QueryTranslatorResult includes toString() for debugging
   * and issue reporting.
   */

  it("should provide toString() for simple equality query", () => {
    const filter: QueryFilter<User> = { name: "Alice" }
    const result = userTranslator.translate(filter)

    const str = result.toString()
    expect(str).toContain("SQL:")
    expect(str).toContain('"_name" = ?')
    expect(str).toContain("Parameters:")
    expect(str).toContain('"Alice"')
  })

  it("should provide toString() for complex query with multiple params", () => {
    const filter: QueryFilter<User> = {
      age: { $gte: 18, $lt: 65 },
    }
    const result = userTranslator.translate(filter)

    const str = result.toString()
    expect(str).toContain("SQL:")
    expect(str).toContain('"_age" >= ?')
    expect(str).toContain('"_age" < ?')
    expect(str).toContain("Parameters:")
    expect(str).toContain("18")
    expect(str).toContain("65")
  })

  it("should provide toString() for empty filter", () => {
    const filter: QueryFilter<User> = {}
    const result = userTranslator.translate(filter)

    const str = result.toString()
    expect(str).toContain("SQL: 1=1")
    expect(str).toContain("Parameters: []")
  })

  it("should provide toString() for translateOptions", () => {
    const options: QueryOptions<User> = {
      sort: { age: -1 },
      limit: 10,
      skip: 20,
    }
    const result = userTranslator.translateOptions(options)

    const str = result.toString()
    expect(str).toContain("SQL:")
    expect(str).toContain('ORDER BY "_age" DESC')
    expect(str).toContain("LIMIT ?")
    expect(str).toContain("OFFSET ?")
    expect(str).toContain("Parameters:")
    expect(str).toContain("10")
    expect(str).toContain("20")
  })

  it("should format toString() output for debugging", () => {
    const filter: QueryFilter<User> = { name: "Bob", age: { $gt: 21 } }
    const result = userTranslator.translate(filter)

    const str = result.toString()
    // Should have two lines: SQL and Parameters
    const lines = str.split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(SQL_LINE_REGEX)
    expect(lines[1]).toMatch(PARAMS_LINE_REGEX)
  })
})
