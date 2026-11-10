/**
 * Batch Operations Throughput Benchmarks
 *
 * Measures throughput for bulk operations to help identify optimal batch sizes
 * and compare different insertion strategies.
 *
 * Run with: bun bench/batch-throughput.bench.ts
 */

import { bench, group, run } from "mitata"
import type { Document } from "../src/core-types.js"
import { createSchema } from "../src/schema-builder.js"
import { Strata } from "../src/stratadb.js"

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

// Schema
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

function createTestDb() {
  return new Strata({ database: ":memory:" })
}

let emailCounter = 0
function generateUser(): Omit<User, "_id"> {
  emailCounter += 1
  return {
    name: `User ${emailCounter}`,
    email: `user${emailCounter}@example.com`,
    age: 20 + (emailCounter % 50),
    status: "active" as const,
    role: emailCounter % 10 === 0 ? "admin" : "user",
    tags: ["tag1", "tag2"],
    score: emailCounter * 10,
    createdAt: Date.now(),
  }
}

function generateUsers(count: number): Omit<User, "_id">[] {
  return Array.from({ length: count }, () => generateUser())
}

// ============================================================================
// SETUP: Pre-populate large dataset for read benchmarks
// ============================================================================

const largeDb = createTestDb()
const largeUsers = largeDb.collection("users", userSchema)
await largeUsers.insertMany(generateUsers(10_000))

// ============================================================================
// BATCH INSERT COMPARISON
// ============================================================================

group("Batch Insert - insertMany vs individual inserts", () => {
  bench("10 docs - insertMany (single call)", async () => {
    const db = createTestDb()
    const users = db.collection("users", userSchema)
    await users.insertMany(generateUsers(10))
    db.close()
  })

  bench("10 docs - individual insertOne calls", async () => {
    const db = createTestDb()
    const users = db.collection("users", userSchema)
    for (const user of generateUsers(10)) {
      await users.insertOne(user)
    }
    db.close()
  })

  bench("100 docs - insertMany (single call)", async () => {
    const db = createTestDb()
    const users = db.collection("users", userSchema)
    await users.insertMany(generateUsers(100))
    db.close()
  })

  bench("100 docs - individual insertOne calls", async () => {
    const db = createTestDb()
    const users = db.collection("users", userSchema)
    for (const user of generateUsers(100)) {
      await users.insertOne(user)
    }
    db.close()
  })
})

// ============================================================================
// TRANSACTION VS NON-TRANSACTION
// ============================================================================

group("Transaction vs No Transaction", () => {
  bench("100 inserts - no explicit transaction", async () => {
    const db = createTestDb()
    const users = db.collection("users", userSchema)
    for (const user of generateUsers(100)) {
      await users.insertOne(user)
    }
    db.close()
  })

  bench("100 inserts - with transaction", async () => {
    const db = createTestDb()
    await db.execute(async (tx) => {
      const users = tx.collection("users", userSchema)
      for (const user of generateUsers(100)) {
        await users.insertOne(user)
      }
    })
    db.close()
  })

  bench("100 inserts - insertMany (implicit transaction)", async () => {
    const db = createTestDb()
    const users = db.collection("users", userSchema)
    await users.insertMany(generateUsers(100))
    db.close()
  })
})

// ============================================================================
// BATCH UPDATE THROUGHPUT
// ============================================================================

group("Batch Update Throughput", () => {
  bench("updateMany - 100 docs, single field", async () => {
    const db = createTestDb()
    const users = db.collection("users", userSchema)
    await users.insertMany(generateUsers(100))
    await users.updateMany({ status: "active" }, { score: 999 })
    db.close()
  })

  bench("updateMany - 100 docs, multiple fields", async () => {
    const db = createTestDb()
    const users = db.collection("users", userSchema)
    await users.insertMany(generateUsers(100))
    await users.updateMany(
      { status: "active" },
      { score: 999, role: "updated" }
    )
    db.close()
  })

  bench("updateMany - 1000 docs, single field", async () => {
    const db = createTestDb()
    const users = db.collection("users", userSchema)
    await users.insertMany(generateUsers(1000))
    await users.updateMany({ status: "active" }, { score: 999 })
    db.close()
  })
})

// ============================================================================
// BATCH DELETE THROUGHPUT
// ============================================================================

group("Batch Delete Throughput", () => {
  bench("deleteMany - 100 docs", async () => {
    const db = createTestDb()
    const users = db.collection("users", userSchema)
    await users.insertMany(generateUsers(100))
    await users.deleteMany({ status: "active" })
    db.close()
  })

  bench("deleteMany - 1000 docs", async () => {
    const db = createTestDb()
    const users = db.collection("users", userSchema)
    await users.insertMany(generateUsers(1000))
    await users.deleteMany({ status: "active" })
    db.close()
  })
})

// ============================================================================
// LARGE DATASET OPERATIONS (10000 docs)
// ============================================================================

group("Large Dataset Operations (10000 docs)", () => {
  bench("count - all documents", async () => {
    await largeUsers.count({})
  })

  bench("count - with indexed filter", async () => {
    await largeUsers.count({ role: "admin" })
  })

  bench("find - with limit 100", async () => {
    await largeUsers.find({}, { limit: 100 })
  })

  bench("find - indexed range + limit", async () => {
    await largeUsers.find({ age: { $gte: 30, $lt: 40 } }, { limit: 100 })
  })

  bench("find - complex query + pagination", async () => {
    await largeUsers.find(
      {
        $and: [{ status: "active" }, { score: { $gt: 500 } }],
      },
      { sort: { score: -1 }, skip: 100, limit: 50 }
    )
  })
})

await run({ throw: true, format: "mitata", colors: false })

// Cleanup
largeDb.close()
