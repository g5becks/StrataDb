import { describe, expect, it } from "bun:test"
import type { Document } from "../../src/core-types.ts"
import { createSchema } from "../../src/schema-builder.ts"
import { Strata } from "../../src/stratadb.ts"

interface TestDoc extends Document {
  name: string
  value: number
}

describe("Cache Configuration", () => {
  describe("Database-level cache configuration", () => {
    it("should disable cache for all collections by default", () => {
      const db = new Strata({ database: ":memory:" })

      const schema = createSchema<TestDoc>()
        .field("name", { type: "TEXT", indexed: true })
        .field("value", { type: "INTEGER" })
        .build()

      const collection = db.collection("test", schema)

      // Access the private translator to check cache size
      const { translator } = collection as any

      // Insert a document to trigger query translation
      collection.insertOne({ name: "test", value: 1 })

      // Query should not be cached (default is false)
      collection.find({ name: "test" })
      expect(translator.cacheSize).toBe(0)

      db.close()
    })

    it("should enable cache for all collections when configured", () => {
      const db = new Strata({
        database: ":memory:",
        enableCache: true,
      })

      const schema = createSchema<TestDoc>()
        .field("name", { type: "TEXT", indexed: true })
        .field("value", { type: "INTEGER" })
        .build()

      const collection = db.collection("test", schema)

      const { translator } = collection as any

      // Query should be cached
      collection.find({ name: "test" })
      expect(translator.cacheSize).toBe(1)

      db.close()
    })

    it("should apply cache setting to multiple collections", () => {
      const db = new Strata({
        database: ":memory:",
        enableCache: true,
      })

      const schema = createSchema<TestDoc>()
        .field("name", { type: "TEXT", indexed: true })
        .field("value", { type: "INTEGER" })
        .build()

      const collection1 = db.collection("test1", schema)
      const collection2 = db.collection("test2", schema)

      const translator1 = (collection1 as any).translator
      const translator2 = (collection2 as any).translator

      // Both collections should have caching enabled
      collection1.find({ name: "test" })
      collection2.find({ name: "test" })

      expect(translator1.cacheSize).toBe(1)
      expect(translator2.cacheSize).toBe(1)

      db.close()
    })
  })

  describe("Collection-level cache override", () => {
    it("should allow collection to override database default (enable when db disabled)", () => {
      const db = new Strata({
        database: ":memory:",
        enableCache: false, // Database default: disabled
      })

      const schema = createSchema<TestDoc>()
        .field("name", { type: "TEXT", indexed: true })
        .field("value", { type: "INTEGER" })
        .build()

      // Override: enable cache for this collection
      const collection = db.collection("test", schema, { enableCache: true })

      const { translator } = collection as any

      collection.find({ name: "test" })
      expect(translator.cacheSize).toBe(1)

      db.close()
    })

    it("should allow collection to override database default (disable when db enabled)", () => {
      const db = new Strata({
        database: ":memory:",
        enableCache: true, // Database default: enabled
      })

      const schema = createSchema<TestDoc>()
        .field("name", { type: "TEXT", indexed: true })
        .field("value", { type: "INTEGER" })
        .build()

      // Override: disable cache for this collection
      const collection = db.collection("test", schema, { enableCache: false })

      const { translator } = collection as any

      collection.find({ name: "test" })
      expect(translator.cacheSize).toBe(0)

      db.close()
    })

    it("should allow mixed cache settings across collections", () => {
      const db = new Strata({
        database: ":memory:",
        enableCache: false, // Database default: disabled
      })

      const schema = createSchema<TestDoc>()
        .field("name", { type: "TEXT", indexed: true })
        .field("value", { type: "INTEGER" })
        .build()

      // Collection 1: use default (disabled)
      const col1 = db.collection("col1", schema)

      // Collection 2: override to enable
      const col2 = db.collection("col2", schema, { enableCache: true })

      // Collection 3: explicitly disable (same as default)
      const col3 = db.collection("col3", schema, { enableCache: false })

      const translator1 = (col1 as any).translator
      const translator2 = (col2 as any).translator
      const translator3 = (col3 as any).translator

      col1.find({ name: "test" })
      col2.find({ name: "test" })
      col3.find({ name: "test" })

      expect(translator1.cacheSize).toBe(0) // Default (disabled)
      expect(translator2.cacheSize).toBe(1) // Enabled override
      expect(translator3.cacheSize).toBe(0) // Explicitly disabled

      db.close()
    })
  })

  describe("CollectionBuilder cache configuration", () => {
    it("should allow cache configuration via builder", () => {
      const db = new Strata({ database: ":memory:" })

      const collection = db
        .collection<TestDoc>("test")
        .field("name", { type: "TEXT", indexed: true })
        .field("value", { type: "INTEGER" })
        .cache(true) // Enable cache via builder
        .build()

      const { translator } = collection as any

      collection.find({ name: "test" })
      expect(translator.cacheSize).toBe(1)

      db.close()
    })

    it("should inherit database default when not specified in builder", () => {
      const db = new Strata({
        database: ":memory:",
        enableCache: true,
      })

      const collection = db
        .collection<TestDoc>("test")
        .field("name", { type: "TEXT", indexed: true })
        .field("value", { type: "INTEGER" })
        // No .cache() call - should inherit database default
        .build()

      const { translator } = collection as any

      collection.find({ name: "test" })
      expect(translator.cacheSize).toBe(1)

      db.close()
    })

    it("should allow builder to override database default", () => {
      const db = new Strata({
        database: ":memory:",
        enableCache: true, // Database default: enabled
      })

      const collection = db
        .collection<TestDoc>("test")
        .field("name", { type: "TEXT", indexed: true })
        .field("value", { type: "INTEGER" })
        .cache(false) // Override: disable cache
        .build()

      const { translator } = collection as any

      collection.find({ name: "test" })
      expect(translator.cacheSize).toBe(0)

      db.close()
    })

    it("should support fluent method chaining with cache()", () => {
      const db = new Strata({ database: ":memory:" })

      const collection = db
        .collection<TestDoc>("test")
        .field("name", { type: "TEXT", indexed: true })
        .cache(true)
        .field("value", { type: "INTEGER" })
        .timestamps(true)
        .build()

      const { translator } = collection as any

      collection.find({ name: "test" })
      expect(translator.cacheSize).toBe(1)
      expect(collection.schema.timestamps).toBe(true)

      db.close()
    })
  })

  describe("Cache behavior verification", () => {
    it("should actually cache repeated queries with same structure", async () => {
      const db = new Strata({
        database: ":memory:",
        enableCache: true,
      })

      const schema = createSchema<TestDoc>()
        .field("name", { type: "TEXT", indexed: true })
        .field("value", { type: "INTEGER" })
        .build()

      const collection = db.collection("test", schema)

      // Insert test data
      await collection.insertMany([
        { name: "Alice", value: 100 },
        { name: "Bob", value: 200 },
        { name: "Charlie", value: 300 },
      ])

      const { translator } = collection as any

      // First query - should populate cache
      await collection.find({ name: "Alice" })
      expect(translator.cacheSize).toBe(1)

      // Same structure, different value - should use cache
      await collection.find({ name: "Bob" })
      expect(translator.cacheSize).toBe(1) // Still 1, same structure

      // Different structure - should add to cache
      await collection.find({ value: { $gt: 150 } })
      expect(translator.cacheSize).toBe(2)

      db.close()
    })

    it("should not cache when disabled", async () => {
      const db = new Strata({
        database: ":memory:",
        enableCache: false,
      })

      const schema = createSchema<TestDoc>()
        .field("name", { type: "TEXT", indexed: true })
        .field("value", { type: "INTEGER" })
        .build()

      const collection = db.collection("test", schema)

      await collection.insertMany([
        { name: "Alice", value: 100 },
        { name: "Bob", value: 200 },
      ])

      const { translator } = collection as any

      // Multiple queries should not populate cache
      await collection.find({ name: "Alice" })
      await collection.find({ name: "Bob" })
      await collection.find({ value: { $gt: 150 } })

      expect(translator.cacheSize).toBe(0)

      db.close()
    })
  })
})
