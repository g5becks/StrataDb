/**
 * Integration tests for $ilike and $contains string operators.
 *
 * These tests verify that the string operators work correctly with actual
 * SQLite database queries through the Collection interface.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { createSchema, type Document, Strata } from "../../src/index.js"

// ============================================================================
// Test Document Types
// ============================================================================

/**
 * User document for testing string operators.
 */
type User = Document<{
  name: string
  email: string
  description: string
  status: "active" | "inactive" | "pending"
}>

// ============================================================================
// Test Setup
// ============================================================================

describe("String Operators Integration", () => {
  let db: Strata

  const createUserSchema = () =>
    createSchema<User>()
      .field("name", { type: "TEXT", indexed: true })
      .field("email", { type: "TEXT", indexed: true })
      .field("description", { type: "TEXT", indexed: false })
      .field("status", { type: "TEXT", indexed: false })
      .build()

  beforeEach(async () => {
    db = new Strata({ database: ":memory:" })
    const users = db.collection("users", createUserSchema())

    // Seed test data with various case variations
    await users.insertMany([
      {
        name: "Alice Smith",
        email: "alice@example.com",
        description: "Software engineer at TechCorp",
        status: "active",
      },
      {
        name: "ALICE JONES",
        email: "ALICE.JONES@COMPANY.COM",
        description: "Product manager",
        status: "active",
      },
      {
        name: "alice brown",
        email: "alice.brown@startup.io",
        description: "UX designer with expertise in mobile apps",
        status: "inactive",
      },
      {
        name: "Bob Wilson",
        email: "bob@gmail.com",
        description: "Backend developer specializing in databases",
        status: "active",
      },
      {
        name: "Charlie Davis",
        email: "charlie@example.com",
        description: "DevOps engineer at CloudInc",
        status: "pending",
      },
      {
        name: "Diana Prince",
        email: "diana@special-chars.co",
        description: "CEO at Wonder@Work Inc.",
        status: "active",
      },
    ])
  })

  afterEach(() => {
    db.close()
  })

  // ==========================================================================
  // $ilike Case-Insensitive Tests
  // ==========================================================================

  describe("$ilike - Case-Insensitive Pattern Matching", () => {
    it("should find all case variations of a name", async () => {
      const users = db.collection("users", createUserSchema())

      const results = await users.find({ name: { $ilike: "%alice%" } })

      expect(results).toHaveLength(3)
      const names = results.map((u) => u.name).sort()
      expect(names).toEqual(["ALICE JONES", "Alice Smith", "alice brown"])
    })

    it("should find case-insensitive match at start (startsWith pattern)", async () => {
      const users = db.collection("users", createUserSchema())

      const results = await users.find({ name: { $ilike: "alice%" } })

      expect(results).toHaveLength(3)
    })

    it("should find case-insensitive match at end (endsWith pattern)", async () => {
      const users = db.collection("users", createUserSchema())

      const results = await users.find({ name: { $ilike: "%smith" } })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe("Alice Smith")
    })

    it("should find case-insensitive email domain", async () => {
      const users = db.collection("users", createUserSchema())

      // Should match both lowercase and uppercase .COM
      const results = await users.find({ email: { $ilike: "%.com" } })

      expect(results.length).toBeGreaterThanOrEqual(4)
    })

    it("should work with non-indexed field", async () => {
      const users = db.collection("users", createUserSchema())

      const results = await users.find({
        description: { $ilike: "%engineer%" },
      })

      // Only Alice Smith and Charlie Davis have "engineer" in description
      // Bob Wilson is a "developer", not an "engineer"
      expect(results).toHaveLength(2)
      expect(results.some((u) => u.name === "Alice Smith")).toBe(true)
      expect(results.some((u) => u.name === "Charlie Davis")).toBe(true)
    })

    it("should return empty array when no matches", async () => {
      const users = db.collection("users", createUserSchema())

      const results = await users.find({ name: { $ilike: "%xyz123%" } })

      expect(results).toHaveLength(0)
    })

    it("should work with underscore wildcard", async () => {
      const users = db.collection("users", createUserSchema())

      // Match "Bob" - B followed by any single char followed by b
      const results = await users.find({ name: { $ilike: "b_b%" } })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe("Bob Wilson")
    })
  })

  // ==========================================================================
  // $contains Substring Tests
  // ==========================================================================

  describe("$contains - Substring Matching", () => {
    it("should find documents containing substring", async () => {
      const users = db.collection("users", createUserSchema())

      const results = await users.find({ email: { $contains: "@example" } })

      expect(results).toHaveLength(2)
      expect(results.some((u) => u.name === "Alice Smith")).toBe(true)
      expect(results.some((u) => u.name === "Charlie Davis")).toBe(true)
    })

    it("should find documents with special character @", async () => {
      const users = db.collection("users", createUserSchema())

      const results = await users.find({
        description: { $contains: "@" },
      })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe("Diana Prince")
    })

    it("should find documents containing hyphen", async () => {
      const users = db.collection("users", createUserSchema())

      const results = await users.find({
        email: { $contains: "special-chars" },
      })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe("Diana Prince")
    })

    it("should match substring case exactly", async () => {
      const users = db.collection("users", createUserSchema())

      const upperResults = await users.find({
        name: { $contains: "ALICE" },
      })

      const lowerResults = await users.find({
        name: { $contains: "alice" },
      })

      expect(upperResults.map((user) => user.name)).toEqual(["ALICE JONES"])
      expect(lowerResults.map((user) => user.name)).toEqual(["alice brown"])
    })

    it("should work with non-indexed field", async () => {
      const users = db.collection("users", createUserSchema())

      const results = await users.find({
        description: { $contains: "database" },
      })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe("Bob Wilson")
    })

    it("should return empty array when no matches", async () => {
      const users = db.collection("users", createUserSchema())

      const results = await users.find({
        description: { $contains: "nonexistent123" },
      })

      expect(results).toHaveLength(0)
    })
  })

  // ==========================================================================
  // Combined Operators Tests
  // ==========================================================================

  describe("Combined String Operators", () => {
    it("should combine $ilike with status filter", async () => {
      const users = db.collection("users", createUserSchema())

      const results = await users.find({
        name: { $ilike: "%alice%" },
        status: "active",
      })

      expect(results).toHaveLength(2)
      expect(results.every((u) => u.status === "active")).toBe(true)
    })

    it("should combine $contains with $in operator", async () => {
      const users = db.collection("users", createUserSchema())

      const results = await users.find({
        email: { $contains: "@example" },
        status: { $in: ["active", "pending"] },
      })

      expect(results).toHaveLength(2)
    })

    it("should combine $ilike with $or", async () => {
      const users = db.collection("users", createUserSchema())

      const results = await users.find({
        $or: [{ name: { $ilike: "%alice%" } }, { name: { $ilike: "%bob%" } }],
      })

      expect(results).toHaveLength(4)
    })

    it("should combine $contains with $and", async () => {
      const users = db.collection("users", createUserSchema())

      const results = await users.find({
        $and: [
          { description: { $contains: "engineer" } },
          { status: "active" },
        ],
      })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe("Alice Smith")
    })

    it("should use $not with $ilike", async () => {
      const users = db.collection("users", createUserSchema())

      const results = await users.find({
        $not: { name: { $ilike: "%alice%" } },
      })

      expect(results).toHaveLength(3)
      expect(results.some((u) => u.name.toLowerCase().includes("alice"))).toBe(
        false
      )
    })

    it("should use $not with $contains", async () => {
      const users = db.collection("users", createUserSchema())

      const results = await users.find({
        $not: { email: { $contains: "@example" } },
      })

      expect(results).toHaveLength(4)
      expect(results.some((u) => u.email.includes("@example"))).toBe(false)
    })

    it("should combine multiple string operators on same field", async () => {
      const users = db.collection("users", createUserSchema())

      // Name starts with case-insensitive "a" and contains "Smith"
      const results = await users.find({
        name: { $ilike: "a%", $contains: "Smith" },
      })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe("Alice Smith")
    })
  })

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("Edge Cases", () => {
    it("should handle empty string in $contains", async () => {
      const users = db.collection("users", createUserSchema())

      // Empty string matches everything
      const results = await users.find({ name: { $contains: "" } })

      expect(results).toHaveLength(6)
    })

    it("should handle $ilike with exact match (no wildcards)", async () => {
      const users = db.collection("users", createUserSchema())

      // Exact match - case-insensitive
      const results = await users.find({ name: { $ilike: "bob wilson" } })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe("Bob Wilson")
    })

    it("should preserve sort order with $ilike", async () => {
      const users = db.collection("users", createUserSchema())

      const results = await users.find(
        { name: { $ilike: "%alice%" } },
        { sort: { name: 1 } }
      )

      expect(results).toHaveLength(3)
      // ASCII sort order: uppercase before lowercase
      expect(results[0].name).toBe("ALICE JONES")
      expect(results[1].name).toBe("Alice Smith")
      expect(results[2].name).toBe("alice brown")
    })

    it("should work with limit and skip", async () => {
      const users = db.collection("users", createUserSchema())

      const results = await users.find(
        { name: { $ilike: "%alice%" } },
        { sort: { name: 1 }, limit: 2, skip: 1 }
      )

      expect(results).toHaveLength(2)
      expect(results[0].name).toBe("Alice Smith")
      expect(results[1].name).toBe("alice brown")
    })
  })
})
