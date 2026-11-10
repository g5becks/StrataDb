import { expect, test } from "bun:test"
import {
  ConnectionError,
  createSchema,
  type Document,
  QueryError,
  type QueryFilter,
  Strata,
} from "../../src/index.js"

type Item = Document<{ name: string; tags: string[] }>
const schema = createSchema<Item>().field("name", { type: "TEXT" }).build()

test.each(["x", { $eq: "x" }, { $in: ["x", "y"] }])(
  "$index retains supported condition %p",
  async (condition) => {
    using db = new Strata({ database: ":memory:" })
    const items = db.collection("items", schema)
    await items.insertOne({ name: "item", tags: ["x"] })
    const filter = {
      tags: { $index: { index: 0, condition } },
    } as unknown as QueryFilter<Item>
    expect(await items.count(filter)).toBe(1)
  }
)

test.each([new Date(), new Map(), Promise.resolve(1), undefined])(
  "$index rejects unsupported bind condition %p with QueryError",
  async (condition) => {
    using db = new Strata({ database: ":memory:" })
    const items = db.collection("items", schema)
    await items.insertOne({ name: "item", tags: ["x"] })
    const filter = {
      tags: { $index: { index: 0, condition } },
    } as unknown as QueryFilter<Item>
    await expect(Promise.try(() => items.find(filter))).rejects.toBeInstanceOf(
      QueryError
    )
  }
)

test.each(["schema", "builder"] as const)(
  "%s collections reject every async database operation after close",
  async (style) => {
    const db = new Strata({ database: ":memory:" })
    const items =
      style === "schema"
        ? db.collection("items", schema)
        : db.collection<Item>("items").field("name", { type: "TEXT" }).build()
    const item = await items.insertOne({ name: "item", tags: ["x"] })
    const operations = [
      () => items.find({}),
      () => items.findOne(item._id),
      () => items.findById(item._id),
      () => items.count({}),
      () => items.search("item", ["name"]),
      () => items.distinct("name"),
      () => items.estimatedDocumentCount(),
      () => items.insertOne({ name: "new", tags: [] }),
      () => items.insertMany([]),
      () => items.updateOne(item._id, { name: "updated" }),
      () => items.updateMany({}, { name: "updated" }),
      () => items.replaceOne(item._id, { name: "replacement", tags: [] }),
      () => items.deleteOne(item._id),
      () => items.deleteMany({}),
      () => items.findOneAndDelete({}),
      () => items.findOneAndUpdate({}, { name: "updated" }),
      () => items.findOneAndReplace({}, { name: "replacement", tags: [] }),
      () => items.validate({ name: "valid", tags: [] }),
      () => items.drop(),
      () => items.find({}, { retry: { retries: 3, minTimeout: 1 } }),
    ]
    db.close()
    for (const operation of operations) {
      let result: Promise<unknown> | undefined
      expect(() => {
        result = operation()
      }).not.toThrow()
      expect(result).toBeInstanceOf(Promise)
      await expect(result).rejects.toBeInstanceOf(ConnectionError)
      await expect(result).rejects.toThrow("database is closed")
    }
    expect(() => items.validateSync({ name: "valid", tags: [] })).toThrow(
      ConnectionError
    )
    if (style === "schema") {
      expect(db.collection("items", schema)).toBe(items)
    }
    expect(() => db.collection("new_items", schema)).toThrow(ConnectionError)
    expect(() => db.transaction()).toThrow(ConnectionError)
    await expect(db.execute(() => 1)).rejects.toBeInstanceOf(ConnectionError)
    expect(() => db.close()).not.toThrow()
  }
)

test("a builder captured before close cannot create a collection afterward", () => {
  const db = new Strata({ database: ":memory:" })
  const builder = db.collection<Item>("late")
  db.close()
  expect(() => builder.field("name", { type: "TEXT" }).build()).toThrow(
    ConnectionError
  )
})
