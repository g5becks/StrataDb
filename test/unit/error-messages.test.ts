import { describe, expect, it } from "bun:test"
import {
  buildDatabaseErrorMessage,
  buildDocumentValidationMessage,
  buildQueryErrorMessage,
  buildTypeMismatchMessage,
  buildUniqueConstraintMessage,
  buildValidationMessage,
  formatValue,
  getTypeName,
} from "../../src/error-messages.ts"

describe("Error Message Utilities", () => {
  describe("formatValue", () => {
    it("should format null", () => {
      expect(formatValue(null)).toBe("null")
    })

    it("should format undefined", () => {
      expect(formatValue(undefined)).toBe("undefined")
    })

    it("should format strings with quotes", () => {
      expect(formatValue("test")).toBe('"test"')
    })

    it("should format numbers", () => {
      expect(formatValue(42)).toBe("42")
      expect(formatValue(3.14)).toBe("3.14")
    })

    it("should format booleans", () => {
      expect(formatValue(true)).toBe("true")
      expect(formatValue(false)).toBe("false")
    })

    it("should format bigints", () => {
      expect(formatValue(BigInt(9_007_199_254_740_991))).toBe(
        "9007199254740991n"
      )
    })

    it("should format dates", () => {
      const date = new Date("2024-01-01T00:00:00.000Z")
      expect(formatValue(date)).toBe("Date(2024-01-01T00:00:00.000Z)")
    })

    it("should format arrays", () => {
      expect(formatValue([1, 2, 3])).toBe("Array(3)")
      expect(formatValue([])).toBe("Array(0)")
    })

    it("should format objects", () => {
      expect(formatValue({ name: "test" })).toBe("Object")
    })

    it("should format RegExp", () => {
      // biome-ignore lint/performance/useTopLevelRegex lint/style/useUnicodeRegex: formatting must preserve the original legacy flags
      expect(formatValue(/test/i)).toBe("/test/i")
    })
  })

  describe("getTypeName", () => {
    it("should return type names for various values", () => {
      expect(getTypeName(null)).toBe("null")
      expect(getTypeName(undefined)).toBe("undefined")
      expect(getTypeName("test")).toBe("string")
      expect(getTypeName(42)).toBe("number")
      expect(getTypeName(true)).toBe("boolean")
      expect(getTypeName([])).toBe("array")
      expect(getTypeName(new Date())).toBe("Date")
      // biome-ignore lint/performance/useTopLevelRegex: test value
      expect(getTypeName(/test/u)).toBe("RegExp")
      expect(getTypeName(new Uint8Array())).toBe("Uint8Array")
      expect(getTypeName({})).toBe("object")
    })
  })

  describe("buildValidationMessage", () => {
    it("should build basic validation message", () => {
      const message = buildValidationMessage("age", "number", "thirty")
      expect(message).toBe(
        "Validation failed for field 'age': expected number, got string \"thirty\""
      )
    })

    it("should include suggestion when provided", () => {
      const message = buildValidationMessage(
        "email",
        "valid email address",
        "invalid",
        "Use format: user@example.com"
      )
      expect(message).toContain("Use format: user@example.com")
    })

    it("should handle complex types", () => {
      const message = buildValidationMessage("data", "object", null)
      expect(message).toBe(
        "Validation failed for field 'data': expected object, got null"
      )
    })
  })

  describe("buildUniqueConstraintMessage", () => {
    it("should build unique constraint message with field and value", () => {
      const message = buildUniqueConstraintMessage(
        "email",
        "user@example.com",
        "users"
      )

      expect(message).toContain("Duplicate value for unique field 'email'")
      expect(message).toContain('"user@example.com"')
      expect(message).toContain("in collection 'users'")
      expect(message).toContain("Use updateOne() with { upsert: true }")
      expect(message).toContain("use findOne() to check for existence")
    })

    it("should build message without collection name", () => {
      const message = buildUniqueConstraintMessage("id", 123)

      expect(message).toContain("Duplicate value for unique field 'id'")
      expect(message).toContain("123")
      expect(message).not.toContain("in collection")
      expect(message).toContain("Use updateOne() with { upsert: true }")
    })

    it("should handle various value types", () => {
      expect(buildUniqueConstraintMessage("name", "Alice")).toContain('"Alice"')
      expect(buildUniqueConstraintMessage("id", 42)).toContain("42")
      expect(buildUniqueConstraintMessage("active", true)).toContain("true")
    })
  })

  describe("buildTypeMismatchMessage", () => {
    it("should build type mismatch message without operator", () => {
      const message = buildTypeMismatchMessage("age", "number", "string")
      expect(message).toBe(
        "Type mismatch for field 'age': expected number, got string"
      )
    })

    it("should build message with operator and suggestions for numbers", () => {
      const message = buildTypeMismatchMessage("age", "number", "string", "$gt")

      expect(message).toContain("Type mismatch for field 'age'")
      expect(message).toContain("expected number, got string")
      expect(message).toContain("operator '$gt' is not valid for number fields")
      expect(message).toContain("$eq, $gt, $gte, $lt, $lte, $in, $ne")
    })

    it("should provide string operator suggestions", () => {
      const message = buildTypeMismatchMessage(
        "name",
        "string",
        "number",
        "$gte"
      )

      expect(message).toContain("$eq, $in, $like, $startsWith, $endsWith, $ne")
    })

    it("should provide boolean operator suggestions", () => {
      const message = buildTypeMismatchMessage(
        "active",
        "boolean",
        "number",
        "$gt"
      )

      expect(message).toContain("$eq, $ne")
    })

    it("should provide array operator suggestions", () => {
      const message = buildTypeMismatchMessage("tags", "array", "string", "$eq")

      expect(message).toContain("$in, $all, $elemMatch, $size")
    })
  })

  describe("buildQueryErrorMessage", () => {
    it("should build query error message", () => {
      const message = buildQueryErrorMessage(
        "$invalidOp",
        "Operator not recognized"
      )

      expect(message).toBe(
        "Query error with operator '$invalidOp': Operator not recognized"
      )
    })

    it("should include suggestion when provided", () => {
      const message = buildQueryErrorMessage(
        "$invalidOp",
        "Operator not recognized",
        "Use valid operators like $eq, $gt, $in"
      )

      expect(message).toContain("Use valid operators like $eq, $gt, $in")
    })
  })

  describe("buildDatabaseErrorMessage", () => {
    it("should build basic database error message", () => {
      const message = buildDatabaseErrorMessage("INSERT")
      expect(message).toBe("Database error during INSERT operation")
    })

    it("should include SQLite error code and name", () => {
      const message = buildDatabaseErrorMessage("INSERT", 19)

      expect(message).toContain("INSERT operation")
      expect(message).toContain("SQLite error 19: SQLITE_CONSTRAINT")
      expect(message).toContain("This usually indicates a constraint violation")
    })

    it("should include details when provided", () => {
      const message = buildDatabaseErrorMessage(
        "UPDATE",
        19,
        "UNIQUE constraint failed: users.email"
      )

      expect(message).toContain("UNIQUE constraint failed")
    })

    it("should provide guidance for common error codes", () => {
      expect(buildDatabaseErrorMessage("QUERY", 5)).toContain(
        "database is locked"
      )
      expect(buildDatabaseErrorMessage("WRITE", 8)).toContain(
        "read-only database"
      )
      expect(buildDatabaseErrorMessage("WRITE", 13)).toContain("Disk is full")
      expect(buildDatabaseErrorMessage("OPEN", 14)).toContain(
        "Cannot open the database file"
      )
      expect(buildDatabaseErrorMessage("OPEN", 26)).toContain(
        "not a valid SQLite database"
      )
    })

    it("should handle unknown error codes", () => {
      const message = buildDatabaseErrorMessage("QUERY", 999)
      expect(message).toContain("UNKNOWN_999")
    })
  })

  describe("buildDocumentValidationMessage", () => {
    it("should build basic validation message", () => {
      const message = buildDocumentValidationMessage()
      expect(message).toBe(
        "Document validation failed. Check that all required fields are present and have correct types."
      )
    })

    it("should include document ID", () => {
      const message = buildDocumentValidationMessage("user-123")
      expect(message).toContain("for id 'user-123'")
    })

    it("should include validator name", () => {
      const message = buildDocumentValidationMessage(
        undefined,
        "Standard Schema"
      )
      expect(message).toContain("using Standard Schema validator")
    })

    it("should include all components", () => {
      const message = buildDocumentValidationMessage(
        "user-456",
        "Standard Schema",
        "Email format invalid"
      )

      expect(message).toContain("for id 'user-456'")
      expect(message).toContain("using Standard Schema validator")
      expect(message).toContain("Email format invalid")
      expect(message).toContain("Check that all required fields are present")
    })
  })
})
