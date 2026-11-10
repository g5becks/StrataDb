import { describe, expect, it } from "bun:test"
import type { Document } from "../../src/core-types.js"
import type { JsonPath } from "../../src/path-types.js"
import { createSchema } from "../../src/schema-builder.js"
import type { SchemaDefinition } from "../../src/schema-types.js"

describe("SchemaBuilder", () => {
  // Test type for schema building
  type User = Document<{
    name: string
    email: string
    age: number
    status: "active" | "inactive"
    tags: string[]
  }>

  describe("field method", () => {
    it("should add field with all properties specified", () => {
      const schema = createSchema<User>()
        .field("name", {
          type: "TEXT",
          indexed: true,
          unique: false,
          nullable: false,
        })
        .build()

      expect(schema.fields).toHaveLength(1)
      expect(schema.fields[0]).toEqual({
        name: "name",
        path: "$.name" as JsonPath,
        type: "TEXT",
        indexed: true,
        unique: false,
        nullable: false,
      })
    })

    it("should default path to $.fieldname when not provided", () => {
      const schema = createSchema<User>()
        .field("email", { type: "TEXT", indexed: true })
        .build()

      expect(schema.fields[0].path).toBe("$.email")
    })

    it("should use custom path when provided", () => {
      const schema = createSchema<User>()
        .field("name", {
          path: "$.profile.name" as JsonPath,
          type: "TEXT",
          indexed: true,
        })
        .build()

      expect(schema.fields[0].path).toBe("$.profile.name")
    })

    it("should add multiple fields in order", () => {
      const schema = createSchema<User>()
        .field("name", { type: "TEXT", indexed: true })
        .field("email", { type: "TEXT", indexed: true })
        .field("age", { type: "INTEGER", indexed: true })
        .build()

      expect(schema.fields).toHaveLength(3)
      expect(schema.fields[0].name).toBe("name")
      expect(schema.fields[1].name).toBe("email")
      expect(schema.fields[2].name).toBe("age")
    })

    it("should handle field with default value", () => {
      const schema = createSchema<User>()
        .field("status", {
          type: "TEXT",
          indexed: true,
          default: "active",
        })
        .build()

      expect(schema.fields[0].default).toBe("active")
    })

    it("should handle field with unique constraint", () => {
      const schema = createSchema<User>()
        .field("email", { type: "TEXT", indexed: true, unique: true })
        .build()

      expect(schema.fields[0].unique).toBe(true)
    })

    it("should handle nullable field", () => {
      const schema = createSchema<User>()
        .field("email", { type: "TEXT", indexed: true, nullable: true })
        .build()

      expect(schema.fields[0].nullable).toBe(true)
    })

    it("should not include optional properties when undefined", () => {
      const schema = createSchema<User>()
        .field("name", { type: "TEXT" })
        .build()

      const [field] = schema.fields
      expect(field.name).toBe("name")
      expect(field.type).toBe("TEXT")
      expect(field.path).toBe("$.name")
      // These properties should not exist when not specified
      expect("nullable" in field).toBe(false)
      expect("indexed" in field).toBe(false)
      expect("unique" in field).toBe(false)
      expect("default" in field).toBe(false)
    })

    it("should support JSON type for array fields", () => {
      const schema = createSchema<User>()
        .field("tags", { type: "JSON", indexed: false })
        .build()

      expect(schema.fields[0].type).toBe("JSON")
    })
  })

  describe("compoundIndex method", () => {
    it("should add compound index with correct field arrays", () => {
      const schema = createSchema<User>()
        .field("name", { type: "TEXT", indexed: true })
        .field("status", { type: "TEXT", indexed: true })
        .compoundIndex("name_status", ["name", "status"])
        .build()

      expect(schema.compoundIndexes).toBeDefined()
      expect(schema.compoundIndexes).toHaveLength(1)
      expect(schema.compoundIndexes?.[0]).toEqual({
        name: "name_status",
        fields: ["name", "status"],
      })
    })

    it("should support unique compound indexes", () => {
      const schema = createSchema<User>()
        .field("email", { type: "TEXT", indexed: true })
        .field("status", { type: "TEXT", indexed: true })
        .compoundIndex("email_status", ["email", "status"], { unique: true })
        .build()

      expect(schema.compoundIndexes?.[0].unique).toBe(true)
    })

    it("should add multiple compound indexes", () => {
      const schema = createSchema<User>()
        .field("name", { type: "TEXT", indexed: true })
        .field("email", { type: "TEXT", indexed: true })
        .field("age", { type: "INTEGER", indexed: true })
        .compoundIndex("name_email", ["name", "email"])
        .compoundIndex("age_status", ["age", "status"])
        .build()

      expect(schema.compoundIndexes).toHaveLength(2)
      expect(schema.compoundIndexes?.[0].name).toBe("name_email")
      expect(schema.compoundIndexes?.[1].name).toBe("age_status")
    })

    it("should preserve field order in compound index", () => {
      const schema = createSchema<User>()
        .field("age", { type: "INTEGER", indexed: true })
        .field("status", { type: "TEXT", indexed: true })
        .compoundIndex("test_index", ["status", "age"])
        .build()

      // Order matters for compound indexes
      expect(schema.compoundIndexes?.[0].fields).toEqual(["status", "age"])
    })

    it("should not include compoundIndexes property when none defined", () => {
      const schema = createSchema<User>()
        .field("name", { type: "TEXT", indexed: true })
        .build()

      expect("compoundIndexes" in schema).toBe(false)
    })
  })

  describe("timestamps method", () => {
    it("should enable timestamp management when true", () => {
      const schema = createSchema<User>()
        .field("name", { type: "TEXT", indexed: true })
        .timestamps(true)
        .build()

      expect(schema.timestamps).toBe(true)
    })

    it("should disable timestamp management when false", () => {
      const schema = createSchema<User>()
        .field("name", { type: "TEXT", indexed: true })
        .timestamps(false)
        .build()

      expect(schema.timestamps).toBe(false)
    })

    it("should default to true when called without arguments", () => {
      const schema = createSchema<User>()
        .field("name", { type: "TEXT", indexed: true })
        .timestamps()
        .build()

      expect(schema.timestamps).toBe(true)
    })

    it("should not include timestamps property when not called", () => {
      const schema = createSchema<User>()
        .field("name", { type: "TEXT", indexed: true })
        .build()

      expect("timestamps" in schema).toBe(false)
    })
  })

  describe("validate method", () => {
    it("should store validation function", () => {
      const validator = (doc: unknown): doc is User => {
        if (typeof doc !== "object" || doc === null) {
          return false
        }
        const obj = doc as Record<string, unknown>
        return (
          typeof obj.name === "string" &&
          typeof obj.email === "string" &&
          typeof obj.age === "number"
        )
      }

      const schema = createSchema<User>()
        .field("name", { type: "TEXT", indexed: true })
        .validate(validator)
        .build()

      expect(schema.validate).toBeDefined()
      expect(schema.validate).toBe(validator)
    })

    it("should use stored validator to validate documents", () => {
      const validator = (doc: unknown): doc is User => {
        if (typeof doc !== "object" || doc === null) {
          return false
        }
        const obj = doc as Record<string, unknown>
        return typeof obj.name === "string" && obj.name.length > 0
      }

      const schema = createSchema<User>()
        .field("name", { type: "TEXT", indexed: true })
        .validate(validator)
        .build()

      const validDoc = { name: "Alice", email: "alice@example.com", age: 30 }
      const invalidDoc = { name: "", email: "test@example.com", age: 25 }

      expect(schema.validate?.(validDoc)).toBe(true)
      expect(schema.validate?.(invalidDoc)).toBe(false)
    })

    it("should not include validate property when not called", () => {
      const schema = createSchema<User>()
        .field("name", { type: "TEXT", indexed: true })
        .build()

      expect("validate" in schema).toBe(false)
    })
  })

  describe("build method", () => {
    it("should return frozen immutable SchemaDefinition", () => {
      const schema = createSchema<User>()
        .field("name", { type: "TEXT", indexed: true })
        .build()

      expect(Object.isFrozen(schema)).toBe(true)
    })

    it("should freeze fields array", () => {
      const schema = createSchema<User>()
        .field("name", { type: "TEXT", indexed: true })
        .build()

      expect(Object.isFrozen(schema.fields)).toBe(true)
    })

    it("should freeze compound indexes array when present", () => {
      const schema = createSchema<User>()
        .field("name", { type: "TEXT", indexed: true })
        .compoundIndex("test_index", ["name"])
        .build()

      expect(Object.isFrozen(schema.compoundIndexes)).toBe(true)
    })

    it("should return new array instances to prevent mutation", () => {
      const builder = createSchema<User>()
        .field("name", { type: "TEXT", indexed: true })
        .field("email", { type: "TEXT", indexed: true })
        .compoundIndex("test_index", ["name"])

      const schema1 = builder.build()
      const schema2 = builder.build()

      // Should be different array instances but same content
      expect(schema1.fields).not.toBe(schema2.fields)
      expect(schema1.fields).toEqual(schema2.fields)
    })

    it("should build complete schema with all features", () => {
      const validator = (doc: unknown): doc is User =>
        typeof doc === "object" && doc !== null

      const schema: SchemaDefinition<User> = createSchema<User>()
        .field("name", { type: "TEXT", indexed: true })
        .field("email", { type: "TEXT", indexed: true, unique: true })
        .field("age", { type: "INTEGER", indexed: true })
        .field("status", {
          type: "TEXT",
          indexed: true,
          default: "active",
        })
        .compoundIndex("age_status", ["age", "status"])
        .timestamps(true)
        .validate(validator)
        .build()

      expect(schema.fields).toHaveLength(4)
      expect(schema.compoundIndexes).toHaveLength(1)
      expect(schema.timestamps).toBe(true)
      expect(schema.validate).toBe(validator)
      expect(Object.isFrozen(schema)).toBe(true)
    })

    it("should build minimal schema with only fields", () => {
      const schema = createSchema<User>()
        .field("name", { type: "TEXT" })
        .build()

      expect(schema.fields).toHaveLength(1)
      expect("compoundIndexes" in schema).toBe(false)
      expect("timestamps" in schema).toBe(false)
      expect("validate" in schema).toBe(false)
    })
  })

  describe("method chaining", () => {
    it("should support fluent API with all methods", () => {
      const validator = (doc: unknown): doc is User =>
        typeof doc === "object" && doc !== null

      const schema = createSchema<User>()
        .field("name", { type: "TEXT", indexed: true })
        .field("email", { type: "TEXT", indexed: true })
        .compoundIndex("name_email", ["name", "email"])
        .timestamps(true)
        .validate(validator)
        .build()

      expect(schema).toBeDefined()
      expect(schema.fields).toHaveLength(2)
    })

    it("should allow multiple calls to same method", () => {
      const schema = createSchema<User>()
        .field("name", { type: "TEXT", indexed: true })
        .field("email", { type: "TEXT", indexed: true })
        .field("age", { type: "INTEGER", indexed: true })
        .compoundIndex("name_email", ["name", "email"])
        .compoundIndex("age_status", ["age", "status"])
        .build()

      expect(schema.fields).toHaveLength(3)
      expect(schema.compoundIndexes).toHaveLength(2)
    })
  })
})
