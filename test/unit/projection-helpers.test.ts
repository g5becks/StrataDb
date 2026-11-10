/**
 * Unit tests for select/omit projection helpers.
 *
 * @remarks
 * These tests verify that the projection normalization and application
 * methods work correctly in SQLiteCollection.
 */

import { Database } from "bun:sqlite"
import { beforeEach, describe, expect, it } from "bun:test"
import { createSchema, type Document } from "../../src/index.js"
import { SQLiteCollection } from "../../src/sqlite-collection.js"

// ============================================================================
// TEST SCHEMAS AND TYPES
// ============================================================================

/**
 * User document type for testing projection helpers.
 */
type User = Document<{
  readonly name: string
  readonly email: string
  readonly age: number
  readonly status: "active" | "inactive" | "pending"
}>

/**
 * Test schema with indexed and non-indexed fields.
 */
const userSchema = createSchema<User>()
  .field("name", { type: "TEXT", indexed: true })
  .field("email", { type: "TEXT", indexed: true })
  .field("age", { type: "INTEGER", indexed: true })
  .field("status", { type: "TEXT", indexed: false })
  .build()

let db: Database
let collection: SQLiteCollection<User>

beforeEach(() => {
  db = new Database(":memory:")
  collection = new SQLiteCollection(db, "users", userSchema, () =>
    Bun.randomUUIDv7()
  )
})

// ============================================================================
// SELECT OPTION TESTS
// ============================================================================

describe("SQLiteCollection - select option", () => {
  it("should return only selected fields plus _id", async () => {
    const inserted = await collection.insertOne({
      name: "Alice",
      email: "alice@example.com",
      age: 30,
      status: "active",
    })

    const results = await collection.find(
      { _id: inserted._id },
      { select: ["name", "email"] }
    )

    expect(results).toHaveLength(1)
    const [result] = results
    expect(result._id).toBe(inserted._id)
    expect(result.name).toBe("Alice")
    expect(result.email).toBe("alice@example.com")
    // These should NOT be present
    expect("age" in result).toBe(false)
    expect("status" in result).toBe(false)
  })

  it("should select a single field", async () => {
    await collection.insertOne({
      name: "Bob",
      email: "bob@example.com",
      age: 25,
      status: "inactive",
    })

    const results = await collection.find({}, { select: ["name"] })

    expect(results).toHaveLength(1)
    const [result] = results
    expect(result.name).toBe("Bob")
    expect("_id" in result).toBe(true)
    expect("email" in result).toBe(false)
    expect("age" in result).toBe(false)
    expect("status" in result).toBe(false)
  })

  it("should work with multiple documents", async () => {
    await collection.insertMany([
      { name: "Alice", email: "a@test.com", age: 30, status: "active" },
      { name: "Bob", email: "b@test.com", age: 25, status: "inactive" },
      { name: "Charlie", email: "c@test.com", age: 35, status: "pending" },
    ])

    const results = await collection.find({}, { select: ["name", "age"] })

    expect(results).toHaveLength(3)
    for (const result of results) {
      expect("_id" in result).toBe(true)
      expect("name" in result).toBe(true)
      expect("age" in result).toBe(true)
      expect("email" in result).toBe(false)
      expect("status" in result).toBe(false)
    }
  })

  it("should work with sort and limit", async () => {
    await collection.insertMany([
      { name: "Alice", email: "a@test.com", age: 30, status: "active" },
      { name: "Bob", email: "b@test.com", age: 25, status: "inactive" },
      { name: "Charlie", email: "c@test.com", age: 35, status: "pending" },
    ])

    const results = await collection.find(
      {},
      { select: ["name"], sort: { age: -1 }, limit: 2 }
    )

    expect(results).toHaveLength(2)
    expect(results[0].name).toBe("Charlie") // oldest
    expect(results[1].name).toBe("Alice")
    expect("email" in results[0]).toBe(false)
  })

  it("should work with query filters", async () => {
    await collection.insertMany([
      { name: "Alice", email: "a@test.com", age: 30, status: "active" },
      { name: "Bob", email: "b@test.com", age: 25, status: "inactive" },
      { name: "Charlie", email: "c@test.com", age: 35, status: "active" },
    ])

    const results = await collection.find(
      { status: "active" },
      { select: ["name", "status"] }
    )

    expect(results).toHaveLength(2)
    for (const result of results) {
      expect(result.status).toBe("active")
      expect("name" in result).toBe(true)
      expect("email" in result).toBe(false)
      expect("age" in result).toBe(false)
    }
  })
})

// ============================================================================
// OMIT OPTION TESTS
// ============================================================================

describe("SQLiteCollection - omit option", () => {
  it("should exclude specified fields and keep all others", async () => {
    const inserted = await collection.insertOne({
      name: "Alice",
      email: "alice@example.com",
      age: 30,
      status: "active",
    })

    const results = await collection.find(
      { _id: inserted._id },
      { omit: ["email", "status"] }
    )

    expect(results).toHaveLength(1)
    const [result] = results
    expect(result._id).toBe(inserted._id)
    expect(result.name).toBe("Alice")
    expect(result.age).toBe(30)
    // These should NOT be present
    expect("email" in result).toBe(false)
    expect("status" in result).toBe(false)
  })

  it("should omit a single field", async () => {
    await collection.insertOne({
      name: "Bob",
      email: "bob@example.com",
      age: 25,
      status: "inactive",
    })

    const results = await collection.find({}, { omit: ["email"] })

    expect(results).toHaveLength(1)
    const [result] = results
    expect("_id" in result).toBe(true)
    expect("name" in result).toBe(true)
    expect("age" in result).toBe(true)
    expect("status" in result).toBe(true)
    expect("email" in result).toBe(false)
  })

  it("should work with multiple documents", async () => {
    await collection.insertMany([
      { name: "Alice", email: "a@test.com", age: 30, status: "active" },
      { name: "Bob", email: "b@test.com", age: 25, status: "inactive" },
      { name: "Charlie", email: "c@test.com", age: 35, status: "pending" },
    ])

    const results = await collection.find({}, { omit: ["age", "status"] })

    expect(results).toHaveLength(3)
    for (const result of results) {
      expect("_id" in result).toBe(true)
      expect("name" in result).toBe(true)
      expect("email" in result).toBe(true)
      expect("age" in result).toBe(false)
      expect("status" in result).toBe(false)
    }
  })

  it("should work with sort and skip", async () => {
    await collection.insertMany([
      { name: "Alice", email: "a@test.com", age: 30, status: "active" },
      { name: "Bob", email: "b@test.com", age: 25, status: "inactive" },
      { name: "Charlie", email: "c@test.com", age: 35, status: "pending" },
    ])

    // SQLite requires LIMIT when using OFFSET
    const results = await collection.find(
      {},
      { omit: ["email"], sort: { name: 1 }, skip: 1, limit: 10 }
    )

    expect(results).toHaveLength(2)
    expect(results[0].name).toBe("Bob")
    expect(results[1].name).toBe("Charlie")
    expect("email" in results[0]).toBe(false)
  })

  it("should work with query filters", async () => {
    await collection.insertMany([
      { name: "Alice", email: "a@test.com", age: 30, status: "active" },
      { name: "Bob", email: "b@test.com", age: 25, status: "inactive" },
      { name: "Charlie", email: "c@test.com", age: 35, status: "active" },
    ])

    const results = await collection.find(
      { age: { $gte: 30 } },
      { omit: ["status"] }
    )

    expect(results).toHaveLength(2)
    for (const result of results) {
      expect(result.age).toBeGreaterThanOrEqual(30)
      expect("status" in result).toBe(false)
    }
  })
})

// ============================================================================
// PROJECTION OPTION TESTS (existing MongoDB-style)
// ============================================================================

describe("SQLiteCollection - projection option", () => {
  it("should include specified fields (projection: { field: 1 })", async () => {
    await collection.insertOne({
      name: "Alice",
      email: "alice@example.com",
      age: 30,
      status: "active",
    })

    const results = await collection.find(
      {},
      { projection: { name: 1, email: 1 } }
    )

    expect(results).toHaveLength(1)
    const [result] = results
    expect("_id" in result).toBe(true)
    expect("name" in result).toBe(true)
    expect("email" in result).toBe(true)
    expect("age" in result).toBe(false)
    expect("status" in result).toBe(false)
  })

  it("should exclude specified fields (projection: { field: 0 })", async () => {
    await collection.insertOne({
      name: "Bob",
      email: "bob@example.com",
      age: 25,
      status: "inactive",
    })

    const results = await collection.find(
      {},
      { projection: { email: 0, status: 0 } }
    )

    expect(results).toHaveLength(1)
    const [result] = results
    expect("_id" in result).toBe(true)
    expect("name" in result).toBe(true)
    expect("age" in result).toBe(true)
    expect("email" in result).toBe(false)
    expect("status" in result).toBe(false)
  })

  it("should exclude _id when projection._id is 0", async () => {
    await collection.insertOne({
      name: "Charlie",
      email: "charlie@example.com",
      age: 35,
      status: "pending",
    })

    const results = await collection.find(
      {},
      { projection: { _id: 0, name: 1, email: 1 } }
    )

    expect(results).toHaveLength(1)
    const [result] = results
    expect("_id" in result).toBe(false)
    expect("name" in result).toBe(true)
    expect("email" in result).toBe(true)
  })
})

// ============================================================================
// PRECEDENCE TESTS
// ============================================================================

describe("SQLiteCollection - projection option precedence", () => {
  beforeEach(async () => {
    await collection.insertOne({
      name: "Test User",
      email: "test@example.com",
      age: 30,
      status: "active",
    })
  })

  it("should prefer projection over select", async () => {
    const results = await collection.find(
      {},
      {
        projection: { name: 1 },
        select: ["email", "age"], // Should be ignored
      }
    )

    expect(results).toHaveLength(1)
    const [result] = results
    expect("name" in result).toBe(true)
    expect("email" in result).toBe(false) // select was ignored
    expect("age" in result).toBe(false)
  })

  it("should prefer projection over omit", async () => {
    const results = await collection.find(
      {},
      {
        projection: { email: 0 },
        omit: ["name"], // Should be ignored
      }
    )

    expect(results).toHaveLength(1)
    const [result] = results
    expect("name" in result).toBe(true) // omit was ignored
    expect("email" in result).toBe(false)
  })

  it("should prefer select over omit when both provided", async () => {
    const results = await collection.find(
      {},
      {
        select: ["name"],
        omit: ["email"], // Should be ignored
      }
    )

    expect(results).toHaveLength(1)
    const [result] = results
    expect("name" in result).toBe(true)
    // When select is used, only selected fields + _id are included
    // So email is not present because it wasn't selected, not because of omit
    expect("email" in result).toBe(false)
    expect("age" in result).toBe(false)
  })
})

// ============================================================================
// EDGE CASES
// ============================================================================

describe("SQLiteCollection - projection edge cases", () => {
  it("should return all fields when no projection options are set", async () => {
    const inserted = await collection.insertOne({
      name: "Alice",
      email: "alice@example.com",
      age: 30,
      status: "active",
    })

    const results = await collection.find({ _id: inserted._id })

    expect(results).toHaveLength(1)
    const [result] = results
    expect(result._id).toBe(inserted._id)
    expect(result.name).toBe("Alice")
    expect(result.email).toBe("alice@example.com")
    expect(result.age).toBe(30)
    expect(result.status).toBe("active")
  })

  it("should handle empty select array", async () => {
    await collection.insertOne({
      name: "Bob",
      email: "bob@example.com",
      age: 25,
      status: "inactive",
    })

    const results = await collection.find({}, { select: [] })

    // Empty select means only _id is returned
    expect(results).toHaveLength(1)
    const [result] = results
    expect("_id" in result).toBe(true)
  })

  it("should handle empty omit array", async () => {
    const inserted = await collection.insertOne({
      name: "Charlie",
      email: "charlie@example.com",
      age: 35,
      status: "pending",
    })

    const results = await collection.find({ _id: inserted._id }, { omit: [] })

    // Empty omit means all fields are returned
    expect(results).toHaveLength(1)
    const [result] = results
    expect(result.name).toBe("Charlie")
    expect(result.email).toBe("charlie@example.com")
    expect(result.age).toBe(35)
    expect(result.status).toBe("pending")
  })

  it("should handle empty projection object", async () => {
    const inserted = await collection.insertOne({
      name: "Diana",
      email: "diana@example.com",
      age: 40,
      status: "active",
    })

    const results = await collection.find(
      { _id: inserted._id },
      { projection: {} }
    )

    // Empty projection means all fields are returned
    expect(results).toHaveLength(1)
    const [result] = results
    expect(result.name).toBe("Diana")
    expect(result.email).toBe("diana@example.com")
  })

  it("should return empty array when no documents match", async () => {
    const results = await collection.find(
      { name: "NonExistent" },
      { select: ["name"] }
    )

    expect(results).toHaveLength(0)
  })

  it("should preserve createdAt and updatedAt when selecting them", async () => {
    const inserted = await collection.insertOne({
      name: "Eve",
      email: "eve@example.com",
      age: 28,
      status: "active",
    })

    // Note: createdAt and updatedAt are in the body, so they can be selected
    const results = await collection.find(
      { _id: inserted._id },
      { select: ["name", "createdAt", "updatedAt"] }
    )

    expect(results).toHaveLength(1)
    const [result] = results
    expect("name" in result).toBe(true)
    expect("createdAt" in result).toBe(true)
    expect("updatedAt" in result).toBe(true)
    expect("email" in result).toBe(false)
  })
})
