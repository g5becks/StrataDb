import { expect, test } from "bun:test"
import {
  createSchema,
  type Document,
  SchemaValidationError,
  Strata,
} from "../../src/index.js"

type Item = Document<{ name: string; count: number }>
const base = createSchema<Item>()
  .field("name", { type: "TEXT", indexed: true })
  .field("count", { type: "INTEGER", indexed: true })
  .build()
const variants = [
  {
    ...base,
    fields: base.fields.map((field) => ({
      ...field,
      type: field.name === "count" ? ("REAL" as const) : field.type,
    })),
  },
  { ...base, timestamps: false },
  {
    ...base,
    fields: base.fields.map((field) => ({ ...field, indexed: false })),
  },
  { ...base, fields: base.fields.map((field) => ({ ...field, unique: true })) },
  { ...base, fields: base.fields.map((field) => ({ ...field, default: 0 })) },
  { ...base, fields: base.fields.filter((field) => field.name !== "count") },
  { ...base, validate: (_doc: unknown): _doc is Item => true },
  {
    ...base,
    compoundIndexes: [{ name: "combined", fields: ["name", "count"] as const }],
  },
]
for (const [index, schema] of variants.entries()) {
  test(`[TASK-248] cached collection rejects schema mismatch ${index}`, () => {
    using db = new Strata({ database: ":memory:" })
    db.collection("items", base)
    expect(() => db.collection("items", schema)).toThrow(SchemaValidationError)
  })
}

test("[TASK-248] equivalent schemas and fluent declarations share cached identity", () => {
  using db = new Strata({ database: ":memory:" })
  const first = db.collection("items", base)
  expect(
    db.collection("items", {
      ...base,
      fields: base.fields.toReversed(),
      timestamps: true,
    })
  ).toBe(first)
  expect(
    db
      .collection<Item>("items")
      .field("count", { type: "INTEGER", indexed: true })
      .field("name", { type: "TEXT", indexed: true })
      .build()
  ).toBe(first)
  expect(() =>
    db
      .collection<Item>("items")
      .field("name", { type: "TEXT", indexed: false })
      .build()
  ).toThrow(SchemaValidationError)
})

for (const fluent of [false, true]) {
  for (const enableCache of [false, true]) {
    test(`[TASK-248] shared retry/cache/timestamp defaults fluent=${fluent}, cache=${enableCache}`, async () => {
      let attempts = 0
      const validate = (_doc: unknown): _doc is Item => {
        attempts += 1
        return attempts > 1
      }
      using db = new Strata({
        database: ":memory:",
        enableCache,
        retry: { retries: 1, minTimeout: 1, shouldRetry: () => true },
      })
      const items = fluent
        ? db
            .collection<Item>("items")
            .field("name", { type: "TEXT", indexed: true })
            .validate(validate)
            .build()
        : db.collection(
            "items",
            createSchema<Item>()
              .field("name", { type: "TEXT", indexed: true })
              .validate(validate)
              .build()
          )
      const inserted = await items.insertOne({ name: "a", count: 1 })
      expect(attempts).toBe(2)
      expect(inserted.createdAt).toBeNumber()
      expect(inserted.updatedAt).toBeNumber()
      expect(await items.count({ name: "a" })).toBe(1)
      const { translator } = items as unknown as {
        translator: { cacheSize: number }
      }
      expect(translator.cacheSize).toBe(enableCache ? 1 : 0)
    })
  }
}

test("[TASK-248] validator identity participates in cache matching", () => {
  using db = new Strata({ database: ":memory:" })
  const validate = (_doc: unknown): _doc is Item => true
  const schema = { ...base, validate }
  const first = db.collection("items", schema)
  expect(db.collection("items", { ...schema })).toBe(first)
  expect(() =>
    db.collection("items", {
      ...base,
      validate: (_doc: unknown): _doc is Item => true,
    })
  ).toThrow(SchemaValidationError)
})

test("[TASK-248] compound index field order remains significant", () => {
  using db = new Strata({ database: ":memory:" })
  db.collection("items", {
    ...base,
    compoundIndexes: [{ name: "combined", fields: ["name", "count"] }],
  })
  expect(() =>
    db.collection("items", {
      ...base,
      compoundIndexes: [{ name: "combined", fields: ["count", "name"] }],
    })
  ).toThrow(SchemaValidationError)
})
