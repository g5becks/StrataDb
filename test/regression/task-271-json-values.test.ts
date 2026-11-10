import { expect, test } from "bun:test"
import {
  createSchema,
  type Document,
  Strata,
  ValidationError,
} from "../../src/index.js"
import { serializeJSON } from "../../src/json-serialization.js"

class Custom {
  value = 1
}
const circular: Record<string, unknown> = {}
circular.self = circular
const cases = [
  ["Map", new Map(), "Map"],
  ["Set", new Set(), "Set"],
  ["NaN", Number.NaN, "number"],
  ["Infinity", Number.POSITIVE_INFINITY, "number"],
  ["-Infinity", Number.NEGATIVE_INFINITY, "number"],
  ["BigInt", 1n, "bigint"],
  ["function", () => 1, "function"],
  ["symbol", Symbol("x"), "symbol"],
  ["array undefined", [undefined], "undefined"],
  ["class", new Custom(), "Custom"],
  ["Date", new Date(), "Date"],
  ["circular", circular, "circular"],
] as const
for (const [label, value, type] of cases) {
  for (const operation of [
    "insertOne",
    "insertMany",
    "replaceOne",
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "$set",
    "$push",
  ] as const) {
    test(`[TASK-271] ${operation} rejects ${label} with path and type atomically`, async () => {
      using db = new Strata({ database: ":memory:" })
      const items = db.collection(
        "items",
        createSchema<
          Document<{ payload?: unknown; tags?: unknown[] }>
        >().build()
      )
      await items.insertOne({ _id: "a", payload: "original", tags: [] })
      const bad = { payload: { nested: value } }
      const run = () => {
        switch (operation) {
          case "insertOne":
            return items.insertOne(bad)
          case "insertMany":
            return items.insertMany([{ payload: "valid" }, bad])
          case "replaceOne":
            return items.replaceOne("a", bad)
          case "updateOne":
            return items.updateOne("a", bad)
          case "updateMany":
            return items.updateMany({}, bad)
          case "findOneAndUpdate":
            return items.findOneAndUpdate("a", bad)
          case "$set":
            return items.updateOne("a", {
              $set: { payload: { nested: value } },
            })
          case "$push":
            return items.updateOne("a", { $push: { tags: { nested: value } } })
          default:
            throw new Error("Unknown operation")
        }
      }
      const promise = run()
      expect(promise).toBeInstanceOf(Promise)
      await expect(promise).rejects.toBeInstanceOf(ValidationError)
      await expect(promise).rejects.toThrow(type)
      await expect(promise).rejects.toThrow("nested")
      expect(await items.count({})).toBe(1)
      expect((await items.findById("a"))?.payload).toBe("original")
    })
  }
}

test("[TASK-271] JSON omission, aliases, sparse arrays, toJSON and depth guard", () => {
  const alias = { n: 1 }
  expect(
    JSON.parse(serializeJSON({ a: alias, b: alias, absent: undefined }))
  ).toEqual({ a: alias, b: alias })
  expect(() => serializeJSON({ tags: new Array(3) })).toThrow("tags[0]")
  class Safe {
    toJSON() {
      return { n: 1 }
    }
  }
  class Unsafe {
    toJSON() {
      return { n: new Map() }
    }
  }
  expect(JSON.parse(serializeJSON({ custom: new Safe() }))).toEqual({
    custom: { n: 1 },
  })
  expect(() => serializeJSON({ custom: new Unsafe() })).toThrow("custom.n")
  let deep: object = {}
  for (let i = 0; i < 1000; i += 1) {
    deep = { deep }
  }
  expect(() => serializeJSON(deep)).toThrow(ValidationError)
})
