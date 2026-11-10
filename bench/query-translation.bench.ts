/**
 * Query Translation Benchmarks
 *
 * Measures the performance of converting StrataDB queries to SQL.
 * This helps identify translation overhead and ensure efficient SQL generation.
 *
 * Run with: bun bench/query-translation.bench.ts
 */

import { bench, group, run } from "mitata"
import type { Document } from "../src/core-types.js"
import { createSchema } from "../src/schema-builder.js"
import { SQLiteQueryTranslator } from "../src/sqlite-query-translator.js"

// Test document type
type User = Document<{
  name: string
  email: string
  age: number
  status:
    | "active"
    | "inactive"
    | "pending"
    | "banned"
    | "deleted"
    | "suspended"
    | "review"
  role: string
  tags: string[]
  score: number
  createdAt: number
}>

// Schema with mixed indexed/non-indexed fields
const userSchema = createSchema<User>()
  .field("name", { type: "TEXT", indexed: true })
  .field("email", { type: "TEXT", indexed: true, unique: true })
  .field("age", { type: "INTEGER", indexed: true })
  .field("status", { type: "TEXT", indexed: false })
  .field("role", { type: "TEXT", indexed: true })
  .field("tags", { type: "TEXT", indexed: false })
  .field("score", { type: "INTEGER", indexed: true })
  .field("createdAt", { type: "INTEGER", indexed: true })
  .build()

const translator = new SQLiteQueryTranslator(userSchema)

group("Simple Queries", () => {
  bench("direct equality (indexed)", () => {
    translator.translate({ name: "Alice" })
  })

  bench("direct equality (non-indexed)", () => {
    translator.translate({ status: "active" })
  })

  bench("null check", () => {
    translator.translate({ status: null })
  })

  bench("$eq operator", () => {
    translator.translate({ age: { $eq: 30 } })
  })
})

group("Comparison Operators", () => {
  bench("$gt operator", () => {
    translator.translate({ age: { $gt: 18 } })
  })

  bench("$gte + $lt range", () => {
    translator.translate({ age: { $gte: 18, $lt: 65 } })
  })

  bench("$in with 3 values", () => {
    translator.translate({ age: { $in: [25, 30, 35] } })
  })

  bench("$in with 10 values", () => {
    translator.translate({
      age: { $in: [20, 25, 30, 35, 40, 45, 50, 55, 60, 65] },
    })
  })

  bench("$nin with 5 values", () => {
    translator.translate({
      status: { $nin: ["banned", "deleted", "suspended", "pending", "review"] },
    })
  })
})

group("String Operators", () => {
  bench("$startsWith", () => {
    translator.translate({ name: { $startsWith: "Admin" } })
  })

  bench("$endsWith", () => {
    translator.translate({ email: { $endsWith: "@company.com" } })
  })

  bench("$like", () => {
    translator.translate({ name: { $like: "%smith%" } })
  })
})

group("Array Operators", () => {
  bench("$all with 2 values", () => {
    translator.translate({ tags: { $all: ["admin", "verified"] } })
  })

  bench("$all with 5 values", () => {
    translator.translate({
      tags: { $all: ["admin", "verified", "premium", "active", "trusted"] },
    })
  })

  bench("$size", () => {
    translator.translate({ tags: { $size: 3 } })
  })

  bench("$elemMatch", () => {
    translator.translate({ tags: { $elemMatch: { $eq: "admin" } } })
  })
})

group("Logical Operators", () => {
  bench("$and with 2 conditions", () => {
    translator.translate({
      $and: [{ status: "active" }, { age: { $gte: 18 } }],
    })
  })

  bench("$and with 5 conditions", () => {
    translator.translate({
      $and: [
        { status: "active" },
        { age: { $gte: 18 } },
        { role: "user" },
        { score: { $gt: 100 } },
        { name: { $ne: "System" } },
      ],
    })
  })

  bench("$or with 3 conditions", () => {
    translator.translate({
      $or: [{ role: "admin" }, { role: "moderator" }, { role: "superuser" }],
    })
  })

  bench("$not", () => {
    translator.translate({ $not: { status: "inactive" } })
  })

  bench("$nor with 2 conditions", () => {
    translator.translate({
      $nor: [{ status: "banned" }, { status: "deleted" }],
    })
  })
})

group("Complex Queries", () => {
  bench("multi-field query (3 fields)", () => {
    translator.translate({
      name: "Alice",
      status: "active",
      age: { $gte: 18 },
    })
  })

  bench("nested $and + $or", () => {
    translator.translate({
      $and: [
        { status: "active" },
        {
          $or: [{ role: "admin" }, { role: "moderator" }],
        },
      ],
    })
  })

  bench("deeply nested (3 levels)", () => {
    translator.translate({
      $and: [
        { name: { $ne: "System" } },
        {
          $or: [
            { $and: [{ age: { $gte: 18 } }, { age: { $lt: 65 } }] },
            { $not: { status: "suspended" } },
          ],
        },
      ],
    })
  })

  bench("real-world: active adult admins", () => {
    translator.translate({
      $and: [
        { status: "active" },
        { age: { $gte: 18 } },
        { $or: [{ role: "admin" }, { role: "moderator" }] },
        { score: { $gte: 50 } },
      ],
    })
  })
})

group("Query Options", () => {
  bench("sort single field", () => {
    translator.translateOptions({ sort: { createdAt: -1 } })
  })

  bench("sort multiple fields", () => {
    translator.translateOptions({ sort: { role: 1, name: 1, createdAt: -1 } })
  })

  bench("limit only", () => {
    translator.translateOptions({ limit: 10 })
  })

  bench("skip + limit (pagination)", () => {
    translator.translateOptions({ skip: 100, limit: 20 })
  })

  bench("sort + pagination", () => {
    translator.translateOptions({
      sort: { createdAt: -1, name: 1 },
      limit: 20,
      skip: 40,
    })
  })
})

group("Empty/Edge Cases", () => {
  bench("empty filter", () => {
    translator.translate({})
  })

  bench("empty $and", () => {
    translator.translate({ $and: [] })
  })

  bench("empty $in", () => {
    translator.translate({ age: { $in: [] } })
  })

  bench("empty options", () => {
    translator.translateOptions({})
  })
})

// Cache performance comparison
// Create a fresh translator to test cold vs warm cache
const cachedTranslator = new SQLiteQueryTranslator(userSchema)
const uncachedTranslator = new SQLiteQueryTranslator(userSchema)

group("Cache Performance - Cold vs Warm", () => {
  // Warm up the cached translator
  cachedTranslator.translate({ name: "warmup" })
  cachedTranslator.translate({ age: { $gt: 0 } })
  cachedTranslator.translate({ status: "warmup", age: { $gte: 0, $lt: 100 } })

  bench("cold cache - simple equality", () => {
    // Clear cache each time to simulate cold
    uncachedTranslator.clearCache()
    uncachedTranslator.translate({ name: "Test" })
  })

  bench("warm cache - simple equality (same structure)", () => {
    // Cache already warm from previous calls with same structure
    cachedTranslator.translate({ name: "DifferentName" })
  })

  bench("cold cache - range query", () => {
    uncachedTranslator.clearCache()
    uncachedTranslator.translate({ age: { $gte: 18, $lt: 65 } })
  })

  bench("warm cache - range query (same structure)", () => {
    cachedTranslator.translate({ age: { $gte: 25, $lt: 50 } })
  })

  bench("cold cache - complex query", () => {
    uncachedTranslator.clearCache()
    uncachedTranslator.translate({
      $and: [
        { status: "active" },
        { age: { $gte: 18 } },
        { $or: [{ role: "admin" }, { role: "moderator" }] },
      ],
    })
  })

  bench("warm cache - complex query (same structure)", () => {
    cachedTranslator.translate({
      $and: [
        { status: "inactive" },
        { age: { $gte: 21 } },
        { $or: [{ role: "user" }, { role: "guest" }] },
      ],
    })
  })
})

// Test repeated queries with varying values (hot path simulation)
const hotPathTranslator = new SQLiteQueryTranslator(userSchema)
// Pre-warm with all structures
hotPathTranslator.translate({ name: "warm" })
hotPathTranslator.translate({ age: { $in: [1, 2, 3] } })
hotPathTranslator.translate({ $and: [{ status: "x" }, { role: "y" }] })

group("Hot Path - Repeated Same Structure", () => {
  bench("100 iterations - simple equality (cached)", () => {
    for (let i = 0; i < 100; i += 1) {
      hotPathTranslator.translate({ name: `User${i}` })
    }
  })

  bench("100 iterations - $in operator (cached)", () => {
    for (let i = 0; i < 100; i += 1) {
      hotPathTranslator.translate({ age: { $in: [i, i + 1, i + 2] } })
    }
  })

  bench("100 iterations - $and with 2 conditions (cached)", () => {
    for (let i = 0; i < 100; i += 1) {
      hotPathTranslator.translate({
        $and: [{ status: `status${i}` }, { role: `role${i}` }],
      })
    }
  })
})

await run({ throw: true, format: "mitata", colors: false })
