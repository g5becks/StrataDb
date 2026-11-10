import { describe, expect, it } from "bun:test"
import type { SchemaDefinition } from "../../src/schema-types.ts"
import { SQLiteQueryTranslator } from "../../src/sqlite-query-translator.ts"

type TestDoc = {
  id: string
  name: string
  age: number
  status: string
}

const schema: SchemaDefinition<TestDoc> = {
  fields: [
    { name: "id", type: "string", required: true },
    { name: "name", type: "string", indexed: true },
    { name: "age", type: "number", indexed: true },
    { name: "status", type: "string" },
  ],
}

describe("Query Cache", () => {
  describe("Cache enabled (default)", () => {
    it("should cache query translations by default", () => {
      const translator = new SQLiteQueryTranslator(schema)

      // First translation - should populate cache
      translator.translate({ name: "Alice" })
      expect(translator.cacheSize).toBe(1)

      // Same structure, different value - should use cache
      translator.translate({ name: "Bob" })
      expect(translator.cacheSize).toBe(1) // Still only 1 cached query structure

      // Different structure - should add to cache
      translator.translate({ age: { $gt: 25 } })
      expect(translator.cacheSize).toBe(2)
    })

    it("should allow clearing the cache", () => {
      const translator = new SQLiteQueryTranslator(schema)

      translator.translate({ name: "Alice" })
      translator.translate({ age: { $gt: 25 } })
      expect(translator.cacheSize).toBe(2)

      translator.clearCache()
      expect(translator.cacheSize).toBe(0)
    })

    it("should produce same results with cached and uncached queries", () => {
      const translator = new SQLiteQueryTranslator(schema)

      // First call - populates cache
      const result1 = translator.translate({ name: "Alice", age: { $gte: 18 } })

      // Second call - uses cache
      const result2 = translator.translate({ name: "Bob", age: { $gte: 21 } })

      // SQL should be identical (structure is the same)
      expect(result1.sql).toBe(result2.sql)

      // Values should be different
      expect(result1.params).toEqual(["Alice", 18])
      expect(result2.params).toEqual(["Bob", 21])
    })
  })

  describe("Cache disabled", () => {
    it("should not cache when enableCache is false", () => {
      const translator = new SQLiteQueryTranslator(schema, {
        enableCache: false,
      })

      translator.translate({ name: "Alice" })
      expect(translator.cacheSize).toBe(0)

      translator.translate({ name: "Bob" })
      expect(translator.cacheSize).toBe(0)

      translator.translate({ age: { $gt: 25 } })
      expect(translator.cacheSize).toBe(0)
    })

    it("should handle clearCache gracefully when cache is disabled", () => {
      const translator = new SQLiteQueryTranslator(schema, {
        enableCache: false,
      })

      // Should not throw
      expect(() => translator.clearCache()).not.toThrow()
      expect(translator.cacheSize).toBe(0)
    })

    it("should produce same results with cache disabled", () => {
      const translator = new SQLiteQueryTranslator(schema, {
        enableCache: false,
      })

      const result1 = translator.translate({ name: "Alice", age: { $gte: 18 } })
      const result2 = translator.translate({ name: "Bob", age: { $gte: 21 } })

      // SQL should be identical (structure is the same)
      expect(result1.sql).toBe(result2.sql)

      // Values should be different
      expect(result1.params).toEqual(["Alice", 18])
      expect(result2.params).toEqual(["Bob", 21])
    })
  })

  describe("Non-cacheable operators", () => {
    it("should not cache queries with $elemMatch", () => {
      const translator = new SQLiteQueryTranslator(schema)

      translator.translate({
        items: { $elemMatch: { price: { $gt: 100 }, qty: { $lt: 5 } } },
      } as any)
      expect(translator.cacheSize).toBe(0)
    })

    it("should cache other queries even after non-cacheable ones", () => {
      const translator = new SQLiteQueryTranslator(schema)

      // Non-cacheable
      translator.translate({
        items: { $elemMatch: { price: { $gt: 100 } } },
      } as any)
      expect(translator.cacheSize).toBe(0)

      // Cacheable
      translator.translate({ name: "Alice" })
      expect(translator.cacheSize).toBe(1)

      // Another cacheable
      translator.translate({ age: { $gt: 25 } })
      expect(translator.cacheSize).toBe(2)
    })
  })

  describe("Cache eviction", () => {
    it("should evict oldest entries when cache is full", () => {
      const translator = new SQLiteQueryTranslator(schema)

      // Fill cache beyond MAX_CACHE_SIZE (500) with unique query structures
      // Each iteration creates a genuinely different query structure by using
      // combinations of operators and fields
      for (let i = 0; i < 501; i += 1) {
        // Create unique query structures using combinations of operators
        if (i < 167) {
          // Simple equality with different fields creates unique structures
          translator.translate({ [`field_${i}`]: "value" } as any)
        } else if (i < 334) {
          // Range queries with $gt
          translator.translate({ [`field_${i}`]: { $gt: 0 } } as any)
        } else {
          // Range queries with $gte and $lt
          translator.translate({
            [`field_${i}`]: { $gte: 0, $lt: 100 },
          } as any)
        }
      }

      // Cache should be at MAX_CACHE_SIZE (500), not 501
      expect(translator.cacheSize).toBe(500)
    })
  })
})
