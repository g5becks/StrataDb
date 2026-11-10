import { describe, expect, it } from "bun:test"
import { CollectionBuilderImpl } from "../../src/collection-builder.js"
import type { Document } from "../../src/core-types.js"
import { createSchema } from "../../src/schema-builder.js"
import { Strata } from "../../src/stratadb.js"

describe("Collection Builder", () => {
  type TestUser = Document<{
    name: string
    email: string
    age: number
    status: "active" | "inactive"
    tags: string[]
  }>

  describe("CollectionBuilderImpl", () => {
    // Create a builder without calling build() to avoid SQLiteCollection instantiation
    // since that requires a real database connection
    const createTestBuilder = () => {
      // We'll test the internal state by accessing private fields through casting
      return new CollectionBuilderImpl<TestUser>(() => {
        throw new Error("Unexpected build in a configuration-only test")
      }, true)
    }

    it("should create instance with correct initial state", () => {
      const builder = createTestBuilder()

      // Since we can't call build() safely without a DB instance,
      // we'll test the internal state by verifying methods return the builder
      expect(builder).toBeInstanceOf(CollectionBuilderImpl)
    })

    it("should add fields using field method", () => {
      const builder = createTestBuilder()

      const result = builder
        .field("name", { type: "TEXT", indexed: true })
        .field("email", { type: "TEXT", indexed: true, unique: true })
        .field("age", { type: "INTEGER", indexed: true })

      // Method should be chainable
      expect(result).toBe(builder)

      // The internal fieldDefs should contain the added fields
      // Accessing private field through any cast for testing
      const internalBuilder = builder as any
      expect(internalBuilder.fieldDefs).toHaveLength(3)
    })

    it("should properly configure field options", () => {
      const builder = createTestBuilder()

      builder.field("email", {
        type: "TEXT",
        indexed: true,
        unique: true,
        nullable: true,
        default: "user@example.com",
      })

      // Access internal fieldDefs to verify configuration
      const internalBuilder = builder as any
      expect(internalBuilder.fieldDefs).toHaveLength(1)

      const [field] = internalBuilder.fieldDefs
      expect(field.name).toBe("email")
      expect(field.type).toBe("TEXT")
      expect(field.indexed).toBe(true)
      expect(field.unique).toBe(true)
      expect(field.nullable).toBe(true)
      expect(field.default).toBe("user@example.com")
    })

    it("should handle fields without optional properties", () => {
      const builder = createTestBuilder()

      builder.field("name", { type: "TEXT" })

      // Access internal fieldDefs to verify configuration
      const internalBuilder = builder as any
      expect(internalBuilder.fieldDefs).toHaveLength(1)

      const [field] = internalBuilder.fieldDefs
      expect(field.name).toBe("name")
      expect(field.type).toBe("TEXT")
      // Optional properties should not exist when not specified
      expect(field).not.toHaveProperty("indexed")
      expect(field).not.toHaveProperty("unique")
      expect(field).not.toHaveProperty("nullable")
      expect(field).not.toHaveProperty("default")
    })

    it("should handle custom paths", () => {
      const builder = createTestBuilder()

      builder.field("name", {
        path: "$.profile.fullName",
        type: "TEXT",
        indexed: true,
      })

      // Access internal fieldDefs to verify path
      const internalBuilder = builder as any
      expect(internalBuilder.fieldDefs).toHaveLength(1)
      expect(internalBuilder.fieldDefs[0].path).toBe("$.profile.fullName")
    })

    it("should add compound indexes", () => {
      const builder = createTestBuilder()

      const result = builder
        .field("name", { type: "TEXT", indexed: true })
        .field("status", { type: "TEXT", indexed: true })
        .compoundIndex("name_status_idx", ["name", "status"])

      expect(result).toBe(builder)

      // Access internal compoundIndexDefs to verify
      const internalBuilder = builder as any
      expect(internalBuilder.fieldDefs).toHaveLength(2)
      expect(internalBuilder.compoundIndexDefs).toHaveLength(1)
      expect(internalBuilder.compoundIndexDefs[0]).toEqual({
        name: "name_status_idx",
        fields: ["name", "status"],
      })
    })

    it("should handle unique compound indexes", () => {
      const builder = createTestBuilder()

      builder
        .field("email", { type: "TEXT", indexed: true })
        .field("status", { type: "TEXT", indexed: true })
        .compoundIndex("email_status_idx", ["email", "status"], {
          unique: true,
        })

      // Access internal compoundIndexDefs to verify
      const internalBuilder = builder as any
      expect(internalBuilder.compoundIndexDefs).toHaveLength(1)
      expect(internalBuilder.compoundIndexDefs[0].unique).toBe(true)
    })

    it("should add multiple compound indexes", () => {
      const builder = createTestBuilder()

      builder
        .field("name", { type: "TEXT", indexed: true })
        .field("email", { type: "TEXT", indexed: true })
        .field("age", { type: "INTEGER", indexed: true })
        .field("status", { type: "TEXT", indexed: true })
        .compoundIndex("name_email", ["name", "email"])
        .compoundIndex("age_status", ["age", "status"])

      // Access internal compoundIndexDefs to verify
      const internalBuilder = builder as any
      expect(internalBuilder.compoundIndexDefs).toHaveLength(2)
      expect(internalBuilder.compoundIndexDefs[0].name).toBe("name_email")
      expect(internalBuilder.compoundIndexDefs[1].name).toBe("age_status")
    })

    it("should manage timestamps", () => {
      const builder = createTestBuilder()

      const result = builder.timestamps()

      expect(result).toBe(builder)

      // Access internal enableTimestamps to verify
      const internalBuilder = builder as any
      expect(internalBuilder.enableTimestamps).toBe(true)
    })

    it("should manage timestamps with explicit true", () => {
      const builder = createTestBuilder()

      builder.timestamps(true)

      // Access internal enableTimestamps to verify
      const internalBuilder = builder as any
      expect(internalBuilder.enableTimestamps).toBe(true)
    })

    it("should disable timestamps", () => {
      const builder = createTestBuilder()

      builder.timestamps(false)

      // Access internal enableTimestamps to verify
      const internalBuilder = builder as any
      expect(internalBuilder.enableTimestamps).toBe(false)
    })

    it("should store validation function", () => {
      const validator = (doc: unknown): doc is TestUser =>
        typeof doc === "object" && doc !== null

      const builder = createTestBuilder()

      const result = builder.validate(validator)

      expect(result).toBe(builder)

      // Access internal validatorFn to verify
      const internalBuilder = builder as any
      expect(internalBuilder.validatorFn).toBe(validator)
    })

    it("should handle validation function that returns correct type", () => {
      const validator = (doc: unknown): doc is TestUser => {
        if (typeof doc !== "object" || doc === null) {
          return false
        }
        const obj = doc as Record<string, unknown>
        return typeof obj.name === "string" && obj.name.length > 0
      }

      const builder = createTestBuilder()

      builder.validate(validator)

      // Access internal validatorFn to verify
      const internalBuilder = builder as any
      expect(internalBuilder.validatorFn).toBe(validator)
    })

    it("should manage query caching", () => {
      const builder = createTestBuilder()

      const result = builder.cache(false)

      expect(result).toBe(builder)

      // Access internal enableCacheOption to verify
      const internalBuilder = builder as any
      expect(internalBuilder.enableCacheOption).toBe(false)
    })

    // For the build method test, we'll need to create a proper database instance
    it("should build complete schema with all features (with real DB)", () => {
      // Create a real database instance for the build test
      using db = new Strata({
        database: ":memory:",
        idGenerator: () => "test-id",
        enableCache: true,
      })
      const builder = db.collection<TestUser>("users")

      const validator = (doc: unknown): doc is TestUser =>
        typeof doc === "object" && doc !== null

      builder
        .field("name", { type: "TEXT", indexed: true })
        .field("email", { type: "TEXT", indexed: true, unique: true })
        .field("age", { type: "INTEGER", indexed: true })
        .field("status", { type: "TEXT", indexed: true, default: "active" })
        .compoundIndex("age_status", ["age", "status"])
        .timestamps(true)
        .validate(validator)

      const collection = builder.build()
      expect(collection.schema.fields).toHaveLength(4)
      expect(collection.schema.compoundIndexes).toHaveLength(1)
      expect(collection.schema.timestamps).toBe(true)
      expect(collection.schema.validate).toBe(validator)
    })

    // Test the actual schema building through createSchema helper which doesn't call build()
    it("should return schema definition via createSchema helper", () => {
      const validator = (doc: unknown): doc is TestUser =>
        typeof doc === "object" && doc !== null

      const schema = createSchema<TestUser>()
        .field("name", { type: "TEXT", indexed: true })
        .field("email", { type: "TEXT", indexed: true, unique: true })
        .field("age", { type: "INTEGER", indexed: true })
        .field("status", { type: "TEXT", indexed: true, default: "active" })
        .compoundIndex("age_status", ["age", "status"])
        .timestamps(true)
        .validate(validator)
        .build()

      // Verify all parts are present in the schema
      expect(schema.fields).toHaveLength(4)
      expect(schema.compoundIndexes).toHaveLength(1)
      expect(schema.timestamps).toBe(true)
      expect(schema.validate).toBe(validator)
    })

    it("should return immutable schema", () => {
      const schema = createSchema<TestUser>()
        .field("name", { type: "TEXT", indexed: true })
        .build()

      // Schema should be frozen
      expect(Object.isFrozen(schema)).toBe(true)
      expect(Object.isFrozen(schema.fields)).toBe(true)
    })

    it("should preserve field order", () => {
      const schema = createSchema<TestUser>()
        .field("first", { type: "TEXT", indexed: true })
        .field("second", { type: "TEXT", indexed: true })
        .field("third", { type: "TEXT", indexed: true })
        .build()

      expect(schema.fields[0].name).toBe("first")
      expect(schema.fields[1].name).toBe("second")
      expect(schema.fields[2].name).toBe("third")
    })

    it("should handle JSON type for array fields", () => {
      const schema = createSchema<TestUser>()
        .field("tags", { type: "JSON", indexed: false })
        .build()

      expect(schema.fields).toHaveLength(1)
      expect(schema.fields[0].type).toBe("JSON")
      expect(schema.fields[0].name).toBe("tags")
      expect(schema.fields[0].indexed).toBe(false)
    })

    it("should work with createSchema fluent API", () => {
      // Test compatibility with the createSchema helper function
      const schema = createSchema<TestUser>()
        .field("name", { type: "TEXT", indexed: true })
        .field("email", { type: "TEXT", indexed: true, unique: true })
        .timestamps()
        .build()

      expect(schema.fields).toHaveLength(2)
      expect(schema.timestamps).toBe(true)

      const fieldNames = schema.fields.map((f) => f.name)
      expect(fieldNames).toContain("name")
      expect(fieldNames).toContain("email")
    })
  })

  describe("Method Chaining", () => {
    // Create a builder without calling build() to avoid SQLiteCollection instantiation
    // since that requires a real database connection
    const createTestBuilder = () => {
      // We'll test the internal state by accessing private fields through casting
      return new CollectionBuilderImpl<TestUser>(() => {
        throw new Error("Unexpected build in a configuration-only test")
      }, true)
    }

    it("should support full fluent API chain", () => {
      const validator = (doc: unknown): doc is TestUser =>
        typeof doc === "object" && doc !== null

      const builder = createTestBuilder()

      const result = builder
        .field("name", { type: "TEXT", indexed: true })
        .field("email", { type: "TEXT", indexed: true, unique: true })
        .field("age", { type: "INTEGER", indexed: true })
        .compoundIndex("name_email", ["name", "email"])
        .timestamps()
        .validate(validator)
        .cache(false)

      // Every method should return the same builder instance
      expect(result).toBe(builder)

      // Verify the internal state instead of calling build()
      const internalBuilder = builder as any
      expect(internalBuilder.fieldDefs).toHaveLength(3)
      expect(internalBuilder.compoundIndexDefs).toHaveLength(1)
      expect(internalBuilder.enableTimestamps).toBe(true)
      expect(internalBuilder.validatorFn).toBe(validator)
      expect(internalBuilder.enableCacheOption).toBe(false)
    })

    it("should allow multiple calls to same method", () => {
      const builder = createTestBuilder()

      builder
        .field("name1", { type: "TEXT", indexed: true })
        .field("name2", { type: "TEXT", indexed: true })
        .field("name3", { type: "TEXT", indexed: true })
        .compoundIndex("idx1", ["name1"])
        .compoundIndex("idx2", ["name2"])

      // Verify internal state
      const internalBuilder = builder as any
      expect(internalBuilder.fieldDefs).toHaveLength(3)
      expect(internalBuilder.compoundIndexDefs).toHaveLength(2)
    })
  })
})
