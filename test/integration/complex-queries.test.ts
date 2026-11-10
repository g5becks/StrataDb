import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import type { Document } from "../../src/core-types.js"
import { createSchema } from "../../src/schema-builder.js"
import { Strata } from "../../src/stratadb.js"

describe("Complex Query Integration Tests", () => {
  let db: Strata

  beforeEach(() => {
    db = new Strata({ database: ":memory:" })
  })

  afterEach(() => {
    db.close()
  })

  // Test type for complex queries
  type Product = Document<{
    name: string
    category: string
    price: number
    tags: string[]
    inStock: boolean
    rating: number
    metadata?: {
      brand: string
      model: string
    }
  }>

  describe("Nested Logical Operators", () => {
    it("should handle AND conditions correctly", async () => {
      const schema = createSchema<Product>()
        .field("name", { type: "TEXT", indexed: true })
        .field("category", { type: "TEXT", indexed: true })
        .field("price", { type: "REAL", indexed: true })
        .field("inStock", { type: "INTEGER", indexed: true })
        .build()

      const products = db.collection("products", schema)

      await products.insertMany([
        {
          name: "Laptop",
          category: "Electronics",
          price: 999,
          tags: [],
          inStock: true,
          rating: 4.5,
        },
        {
          name: "Mouse",
          category: "Electronics",
          price: 29,
          tags: [],
          inStock: true,
          rating: 4.2,
        },
        {
          name: "Desk",
          category: "Furniture",
          price: 299,
          tags: [],
          inStock: false,
          rating: 4.0,
        },
      ])

      const results = await products.find({
        $and: [
          { category: "Electronics" },
          { price: { $gte: 50 } },
          { inStock: true },
        ],
      })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe("Laptop")
    })

    it("should handle OR conditions correctly", async () => {
      const schema = createSchema<Product>()
        .field("name", { type: "TEXT", indexed: true })
        .field("category", { type: "TEXT", indexed: true })
        .field("price", { type: "REAL", indexed: true })
        .build()

      const products = db.collection("products", schema)

      await products.insertMany([
        {
          name: "Laptop",
          category: "Electronics",
          price: 999,
          tags: [],
          inStock: true,
          rating: 4.5,
        },
        {
          name: "Mouse",
          category: "Electronics",
          price: 29,
          tags: [],
          inStock: true,
          rating: 4.2,
        },
        {
          name: "Desk",
          category: "Furniture",
          price: 299,
          tags: [],
          inStock: false,
          rating: 4.0,
        },
      ])

      const results = await products.find({
        $or: [{ category: "Furniture" }, { price: { $lt: 50 } }],
      })

      expect(results).toHaveLength(2)
      const names = results.map((p) => p.name).sort()
      expect(names).toEqual(["Desk", "Mouse"])
    })

    it("should handle NOR conditions correctly", async () => {
      const schema = createSchema<Product>()
        .field("name", { type: "TEXT", indexed: true })
        .field("category", { type: "TEXT", indexed: true })
        .field("price", { type: "REAL", indexed: true })
        .build()

      const products = db.collection("products", schema)

      await products.insertMany([
        {
          name: "Laptop",
          category: "Electronics",
          price: 999,
          tags: [],
          inStock: true,
          rating: 4.5,
        },
        {
          name: "Mouse",
          category: "Electronics",
          price: 29,
          tags: [],
          inStock: true,
          rating: 4.2,
        },
        {
          name: "Desk",
          category: "Furniture",
          price: 299,
          tags: [],
          inStock: false,
          rating: 4.0,
        },
      ])

      const results = await products.find({
        $nor: [{ category: "Electronics" }, { price: { $gt: 500 } }],
      })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe("Desk")
    })

    it("should handle NOT conditions correctly", async () => {
      const schema = createSchema<Product>()
        .field("name", { type: "TEXT", indexed: true })
        .field("category", { type: "TEXT", indexed: true })
        .build()

      const products = db.collection("products", schema)

      await products.insertMany([
        {
          name: "Laptop",
          category: "Electronics",
          price: 999,
          tags: [],
          inStock: true,
          rating: 4.5,
        },
        {
          name: "Desk",
          category: "Furniture",
          price: 299,
          tags: [],
          inStock: false,
          rating: 4.0,
        },
      ])

      const results = await products.find({
        $not: { category: "Electronics" },
      })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe("Desk")
    })

    it("should handle deeply nested logical operators with correct precedence", async () => {
      const schema = createSchema<Product>()
        .field("name", { type: "TEXT", indexed: true })
        .field("category", { type: "TEXT", indexed: true })
        .field("price", { type: "REAL", indexed: true })
        .field("inStock", { type: "INTEGER", indexed: true })
        .build()

      const products = db.collection("products", schema)

      await products.insertMany([
        {
          name: "Laptop",
          category: "Electronics",
          price: 999,
          tags: [],
          inStock: true,
          rating: 4.5,
        },
        {
          name: "Mouse",
          category: "Electronics",
          price: 29,
          tags: [],
          inStock: true,
          rating: 4.2,
        },
        {
          name: "Desk",
          category: "Furniture",
          price: 299,
          tags: [],
          inStock: false,
          rating: 4.0,
        },
        {
          name: "Chair",
          category: "Furniture",
          price: 199,
          tags: [],
          inStock: true,
          rating: 4.3,
        },
      ])

      // Find products that are either:
      // 1. Electronics AND expensive (>500) OR
      // 2. Furniture AND in stock
      const results = await products.find({
        $or: [
          {
            $and: [{ category: "Electronics" }, { price: { $gt: 500 } }],
          },
          {
            $and: [{ category: "Furniture" }, { inStock: true }],
          },
        ],
      })

      expect(results).toHaveLength(2)
      const names = results.map((p) => p.name).sort()
      expect(names).toEqual(["Chair", "Laptop"])
    })
  })

  describe("Array Operators", () => {
    it("should handle $all operator correctly", async () => {
      const schema = createSchema<Product>()
        .field("name", { type: "TEXT", indexed: true })
        .field("tags", { type: "JSON" })
        .build()

      const products = db.collection("products", schema)

      await products.insertMany([
        {
          name: "Laptop",
          category: "Electronics",
          price: 999,
          tags: ["premium", "portable", "fast"],
          inStock: true,
          rating: 4.5,
        },
        {
          name: "Mouse",
          category: "Electronics",
          price: 29,
          tags: ["portable", "wireless"],
          inStock: true,
          rating: 4.2,
        },
        {
          name: "Desk",
          category: "Furniture",
          price: 299,
          tags: ["premium", "large"],
          inStock: false,
          rating: 4.0,
        },
      ])

      const results = await products.find({
        tags: { $all: ["premium", "portable"] },
      })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe("Laptop")
    })

    it("should handle $size operator correctly", async () => {
      const schema = createSchema<Product>()
        .field("name", { type: "TEXT", indexed: true })
        .field("tags", { type: "JSON" })
        .build()

      const products = db.collection("products", schema)

      await products.insertMany([
        {
          name: "Laptop",
          category: "Electronics",
          price: 999,
          tags: ["premium", "portable", "fast"],
          inStock: true,
          rating: 4.5,
        },
        {
          name: "Mouse",
          category: "Electronics",
          price: 29,
          tags: ["portable", "wireless"],
          inStock: true,
          rating: 4.2,
        },
        {
          name: "Desk",
          category: "Furniture",
          price: 299,
          tags: ["premium"],
          inStock: false,
          rating: 4.0,
        },
      ])

      const results = await products.find({
        tags: { $size: 2 },
      })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe("Mouse")
    })

    it("should handle $elemMatch operator with complex conditions", async () => {
      type Order = Document<{
        customer: string
        items: Array<{ name: string; quantity: number; price: number }>
        total: number
      }>

      const schema = createSchema<Order>()
        .field("customer", { type: "TEXT", indexed: true })
        .field("items", { type: "BLOB" })
        .field("total", { type: "REAL", indexed: true })
        .build()

      const orders = db.collection("orders", schema)

      await orders.insertMany([
        {
          customer: "Alice",
          items: [
            { name: "Laptop", quantity: 1, price: 999 },
            { name: "Mouse", quantity: 2, price: 29 },
          ],
          total: 1057,
        },
        {
          customer: "Bob",
          items: [
            { name: "Desk", quantity: 1, price: 299 },
            { name: "Chair", quantity: 1, price: 199 },
          ],
          total: 498,
        },
      ])

      // Find orders with items that are both expensive (>500) and quantity = 1
      const results = await orders.find({
        items: {
          $elemMatch: {
            price: { $gt: 500 },
            quantity: 1,
          },
        },
      })

      expect(results).toHaveLength(1)
      expect(results[0].customer).toBe("Alice")
    })
  })

  describe("String Operators", () => {
    it("should handle $like operator correctly", async () => {
      const schema = createSchema<Product>()
        .field("name", { type: "TEXT", indexed: true })
        .build()

      const products = db.collection("products", schema)

      await products.insertMany([
        {
          name: "Gaming Mouse",
          category: "Electronics",
          price: 49,
          tags: [],
          inStock: true,
          rating: 4.5,
        },
        {
          name: "Office Mouse",
          category: "Electronics",
          price: 29,
          tags: [],
          inStock: true,
          rating: 4.2,
        },
        {
          name: "Gaming Keyboard",
          category: "Electronics",
          price: 99,
          tags: [],
          inStock: true,
          rating: 4.6,
        },
      ])

      const results = await products.find({
        name: { $like: "%Mouse%" },
      })

      expect(results).toHaveLength(2)
      const names = results.map((p) => p.name).sort()
      expect(names).toEqual(["Gaming Mouse", "Office Mouse"])
    })

    it("should handle $startsWith operator correctly", async () => {
      const schema = createSchema<Product>()
        .field("name", { type: "TEXT", indexed: true })
        .build()

      const products = db.collection("products", schema)

      await products.insertMany([
        {
          name: "Pro Laptop",
          category: "Electronics",
          price: 999,
          tags: [],
          inStock: true,
          rating: 4.5,
        },
        {
          name: "Pro Mouse",
          category: "Electronics",
          price: 79,
          tags: [],
          inStock: true,
          rating: 4.3,
        },
        {
          name: "Basic Laptop",
          category: "Electronics",
          price: 499,
          tags: [],
          inStock: true,
          rating: 4.0,
        },
      ])

      const results = await products.find({
        name: { $startsWith: "Pro" },
      })

      expect(results).toHaveLength(2)
      const names = results.map((p) => p.name).sort()
      expect(names).toEqual(["Pro Laptop", "Pro Mouse"])
    })

    it("should handle $endsWith operator correctly", async () => {
      const schema = createSchema<Product>()
        .field("name", { type: "TEXT", indexed: true })
        .build()

      const products = db.collection("products", schema)

      await products.insertMany([
        {
          name: "Wireless Mouse",
          category: "Electronics",
          price: 49,
          tags: [],
          inStock: true,
          rating: 4.5,
        },
        {
          name: "USB Mouse",
          category: "Electronics",
          price: 29,
          tags: [],
          inStock: true,
          rating: 4.2,
        },
        {
          name: "Wireless Keyboard",
          category: "Electronics",
          price: 89,
          tags: [],
          inStock: true,
          rating: 4.4,
        },
      ])

      const results = await products.find({
        name: { $endsWith: "Mouse" },
      })

      expect(results).toHaveLength(2)
      const names = results.map((p) => p.name).sort()
      expect(names).toEqual(["USB Mouse", "Wireless Mouse"])
    })
  })

  describe("Comparison Operators with Nested Paths", () => {
    it("should handle nested path queries correctly", async () => {
      const schema = createSchema<Product>()
        .field("name", { type: "TEXT", indexed: true })
        .field("metadata", { type: "JSON" })
        .build()

      const products = db.collection("products", schema)

      await products.insertMany([
        {
          name: "Laptop",
          category: "Electronics",
          price: 999,
          tags: [],
          inStock: true,
          rating: 4.5,
          metadata: { brand: "Apple", model: "MacBook Pro" },
        },
        {
          name: "Mouse",
          category: "Electronics",
          price: 29,
          tags: [],
          inStock: true,
          rating: 4.2,
          metadata: { brand: "Logitech", model: "MX Master" },
        },
      ])

      const results = await products.find({
        "metadata.brand": "Apple",
      })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe("Laptop")
    })

    it("should handle comparison operators on nested paths", async () => {
      type Review = Document<{
        product: string
        score: {
          overall: number
          quality: number
          value: number
        }
      }>

      const schema = createSchema<Review>()
        .field("product", { type: "TEXT", indexed: true })
        .field("score", { type: "JSON" })
        .build()

      const reviews = db.collection("reviews", schema)

      await reviews.insertMany([
        {
          product: "Laptop",
          score: { overall: 4.5, quality: 5.0, value: 4.0 },
        },
        {
          product: "Mouse",
          score: { overall: 4.2, quality: 4.0, value: 4.5 },
        },
        {
          product: "Keyboard",
          score: { overall: 3.8, quality: 3.5, value: 4.2 },
        },
      ])

      const results = await reviews.find({
        "score.quality": { $gte: 4.0 },
      })

      expect(results).toHaveLength(2)
      const products = results.map((r) => r.product).sort()
      expect(products).toEqual(["Laptop", "Mouse"])
    })
  })

  describe("Query Options Combinations", () => {
    it("should combine sort, limit, and skip correctly", async () => {
      const schema = createSchema<Product>()
        .field("name", { type: "TEXT", indexed: true })
        .field("price", { type: "REAL", indexed: true })
        .build()

      const products = db.collection("products", schema)

      await products.insertMany([
        {
          name: "A",
          category: "Electronics",
          price: 100,
          tags: [],
          inStock: true,
          rating: 4.0,
        },
        {
          name: "B",
          category: "Electronics",
          price: 200,
          tags: [],
          inStock: true,
          rating: 4.1,
        },
        {
          name: "C",
          category: "Electronics",
          price: 300,
          tags: [],
          inStock: true,
          rating: 4.2,
        },
        {
          name: "D",
          category: "Electronics",
          price: 400,
          tags: [],
          inStock: true,
          rating: 4.3,
        },
        {
          name: "E",
          category: "Electronics",
          price: 500,
          tags: [],
          inStock: true,
          rating: 4.4,
        },
      ])

      const results = await products.find(
        {},
        {
          sort: { price: -1 }, // Descending
          skip: 1,
          limit: 2,
        }
      )

      expect(results).toHaveLength(2)
      expect(results[0].name).toBe("D") // 400 (skipped 500)
      expect(results[1].name).toBe("C") // 300
    })

    it("should handle projection with complex queries", async () => {
      const schema = createSchema<Product>()
        .field("name", { type: "TEXT", indexed: true })
        .field("category", { type: "TEXT", indexed: true })
        .field("price", { type: "REAL", indexed: true })
        .build()

      const products = db.collection("products", schema)

      await products.insertMany([
        {
          name: "Laptop",
          category: "Electronics",
          price: 999,
          tags: ["premium"],
          inStock: true,
          rating: 4.5,
        },
        {
          name: "Mouse",
          category: "Electronics",
          price: 29,
          tags: ["budget"],
          inStock: true,
          rating: 4.2,
        },
      ])

      const results = await products.find(
        { category: "Electronics" },
        {
          projection: { name: 1, price: 1, createdAt: 1, updatedAt: 1 },
        }
      )

      expect(results).toHaveLength(2)
      for (const product of results) {
        expect(product.name).toBeDefined()
        expect(product.price).toBeDefined()
        expect(product._id).toBeDefined() // ID always included
        expect(product.createdAt).toBeDefined() // Timestamps always included
        expect(product.updatedAt).toBeDefined()
        // category should not be included
        expect("category" in product).toBe(false)
      }
    })

    it("should sort by multiple fields correctly", async () => {
      const schema = createSchema<Product>()
        .field("category", { type: "TEXT", indexed: true })
        .field("price", { type: "REAL", indexed: true })
        .field("name", { type: "TEXT", indexed: true })
        .build()

      const products = db.collection("products", schema)

      await products.insertMany([
        {
          name: "B",
          category: "Electronics",
          price: 100,
          tags: [],
          inStock: true,
          rating: 4.0,
        },
        {
          name: "A",
          category: "Electronics",
          price: 100,
          tags: [],
          inStock: true,
          rating: 4.1,
        },
        {
          name: "D",
          category: "Furniture",
          price: 200,
          tags: [],
          inStock: true,
          rating: 4.2,
        },
        {
          name: "C",
          category: "Furniture",
          price: 200,
          tags: [],
          inStock: true,
          rating: 4.3,
        },
      ])

      const results = await products.find(
        {},
        {
          sort: { category: 1, price: 1, name: 1 },
        }
      )

      expect(results).toHaveLength(4)
      expect(results[0].name).toBe("A") // Electronics, 100, A
      expect(results[1].name).toBe("B") // Electronics, 100, B
      expect(results[2].name).toBe("C") // Furniture, 200, C
      expect(results[3].name).toBe("D") // Furniture, 200, D
    })
  })

  describe("Edge Cases", () => {
    it("should distinguish between null and undefined correctly", async () => {
      type TestDoc = Document<{
        name: string
        optional?: string
        nullable: string | null
      }>

      const schema = createSchema<TestDoc>()
        .field("name", { type: "TEXT", indexed: true })
        .field("optional", { type: "TEXT", nullable: true })
        .field("nullable", { type: "TEXT", nullable: true })
        .build()

      const docs = db.collection("testdocs", schema)

      await docs.insertMany([
        { name: "A", nullable: null },
        { name: "B", nullable: "value", optional: "set" },
      ])

      const nullResults = await docs.find({
        nullable: null,
      })

      expect(nullResults).toHaveLength(1)
      expect(nullResults[0].name).toBe("A")
    })

    it("should handle empty array queries correctly", async () => {
      const schema = createSchema<Product>()
        .field("name", { type: "TEXT", indexed: true })
        .field("tags", { type: "JSON" })
        .build()

      const products = db.collection("products", schema)

      await products.insertMany([
        {
          name: "A",
          category: "Electronics",
          price: 100,
          tags: [],
          inStock: true,
          rating: 4.0,
        },
        {
          name: "B",
          category: "Electronics",
          price: 200,
          tags: ["tag1"],
          inStock: true,
          rating: 4.1,
        },
        {
          name: "C",
          category: "Electronics",
          price: 300,
          tags: ["tag1", "tag2"],
          inStock: true,
          rating: 4.2,
        },
      ])

      const emptyResults = await products.find({
        tags: { $size: 0 },
      })

      expect(emptyResults).toHaveLength(1)
      expect(emptyResults[0].name).toBe("A")
    })

    it("should handle queries with no results correctly", async () => {
      const schema = createSchema<Product>()
        .field("name", { type: "TEXT", indexed: true })
        .field("price", { type: "REAL", indexed: true })
        .build()

      const products = db.collection("products", schema)

      await products.insertMany([
        {
          name: "A",
          category: "Electronics",
          price: 100,
          tags: [],
          inStock: true,
          rating: 4.0,
        },
        {
          name: "B",
          category: "Electronics",
          price: 200,
          tags: [],
          inStock: true,
          rating: 4.1,
        },
      ])

      const results = await products.find({
        price: { $gt: 1000 },
      })

      expect(results).toHaveLength(0)
      expect(results).toEqual([])
    })

    it("should handle complex queries returning all documents", async () => {
      const schema = createSchema<Product>()
        .field("name", { type: "TEXT", indexed: true })
        .field("price", { type: "REAL", indexed: true })
        .build()

      const products = db.collection("products", schema)

      await products.insertMany([
        {
          name: "A",
          category: "Electronics",
          price: 100,
          tags: [],
          inStock: true,
          rating: 4.0,
        },
        {
          name: "B",
          category: "Electronics",
          price: 200,
          tags: [],
          inStock: true,
          rating: 4.1,
        },
        {
          name: "C",
          category: "Electronics",
          price: 300,
          tags: [],
          inStock: true,
          rating: 4.2,
        },
      ])

      const results = await products.find({
        $or: [{ price: { $gte: 0 } }, { price: { $lt: 0 } }],
      })

      expect(results).toHaveLength(3)
    })

    it("should handle boolean field queries correctly", async () => {
      const schema = createSchema<Product>()
        .field("name", { type: "TEXT", indexed: true })
        .field("inStock", { type: "INTEGER", indexed: true })
        .build()

      const products = db.collection("products", schema)

      await products.insertMany([
        {
          name: "A",
          category: "Electronics",
          price: 100,
          tags: [],
          inStock: true,
          rating: 4.0,
        },
        {
          name: "B",
          category: "Electronics",
          price: 200,
          tags: [],
          inStock: false,
          rating: 4.1,
        },
        {
          name: "C",
          category: "Electronics",
          price: 300,
          tags: [],
          inStock: true,
          rating: 4.2,
        },
      ])

      const inStockResults = await products.find({ inStock: true })

      expect(inStockResults).toHaveLength(2)
      const names = inStockResults.map((p) => p.name).sort()
      expect(names).toEqual(["A", "C"])
    })
  })
})
