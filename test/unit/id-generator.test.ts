import { describe, expect, it } from "bun:test"
import { generateId } from "../../src/id-generator.js"

// UUID v7 format regex: 8-4-4-4-12 hex characters with version '7' in the right place
const UUID_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

describe("ID Generator", () => {
  describe("generateId", () => {
    it("should return a string", () => {
      const id = generateId()
      expect(typeof id).toBe("string")
    })

    it("should generate UUID v7 format", () => {
      const id = generateId()
      expect(id).toMatch(UUID_V7_REGEX)
    })

    it("should generate unique IDs", () => {
      const id1 = generateId()
      const id2 = generateId()
      expect(id1).not.toBe(id2)
    })

    it("should generate multiple unique IDs", () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i += 1) {
        const id = generateId()
        expect(ids.has(id)).toBe(false)
        ids.add(id)
      }
      expect(ids.size).toBe(100)
    })

    it("should generate time-sortable IDs", () => {
      // Generate first ID
      const id1 = generateId()
      // Wait to ensure different timestamp component
      Bun.sleepSync(2) // Sleep 2ms to ensure different timestamp
      const id2 = generateId()

      // IDs generated later should be lexicographically greater
      expect(id1 < id2).toBe(true)
    })

    it("should have consistent length", () => {
      const id = generateId()
      expect(id.length).toBe(36) // Standard UUID length including hyphens
    })

    it("should have version identifier in correct position", () => {
      const id = generateId()
      // Position 14 (0-indexed) should contain '7' for UUID v7
      expect(id.charAt(14)).toBe("7")
    })
  })
})
