import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  createSchema,
  type Document,
  QueryError,
  type QueryFilter,
  Strata,
} from "../../src/index.js"

type Item = Document<{
  name?: string | null
  nested?: { text: string }
  entries?: { text: string }[]
}>
const regexpOperand = /x/u
for (const indexed of [false, true]) {
  for (const enableCache of [false, true]) {
    test(`[TASK-256] regex real SQLite indexed=${indexed}, cached=${enableCache}`, async () => {
      using db = new Strata({ database: ":memory:", enableCache })
      const items = db.collection(
        "items",
        createSchema<Item>().field("name", { type: "TEXT", indexed }).build()
      )
      await items.insertMany([
        {
          _id: "a",
          name: "Alice",
          nested: { text: "é123" },
          entries: [{ text: "héllo" }],
        },
        { _id: "b", name: "Bob", entries: [{ text: "other" }] },
        { _id: "c", name: null },
        { _id: "d" },
      ])
      for (const [pattern, ids] of [
        ["^A.*e$", ["a"]],
        ["^B", ["b"]],
        ["", ["a", "b"]],
        ["^alice$", []],
        ["'; DROP TABLE items; --", []],
      ] as const) {
        expect(
          (
            await items.find(
              { name: { $regex: pattern } } as QueryFilter<Item>,
              { sort: { _id: 1 } }
            )
          ).map((row) => row._id)
        ).toEqual([...ids])
      }
      expect(
        await items.count({
          "nested.text": { $regex: "^\\p{L}\\d+$" },
        } as QueryFilter<Item>)
      ).toBe(1)
      expect(
        await items.count({
          entries: { $elemMatch: { text: { $regex: "^h.+o$" } } },
        } as QueryFilter<Item>)
      ).toBe(1)
      expect(await items.count({})).toBe(4)
      for (const pattern of ["[", "(", 123, regexpOperand]) {
        await expect(
          items.find({ name: { $regex: pattern } } as QueryFilter<Item>)
        ).rejects.toBeInstanceOf(QueryError)
      }
    })
  }
}
test("[TASK-256] regex validates even empty tables and registers once per connection", async () => {
  const native = new Database(":memory:")
  let registrations = 0
  const register = native.function
  Object.defineProperty(native, "function", {
    value(name: string, ...args: unknown[]) {
      if (name === "strata_regexp") {
        registrations += 1
      }
      return Reflect.apply(register, this, [name, ...args])
    },
  })
  using db = new Strata({ database: native })
  const items = db.collection("items", createSchema<Item>().build())
  db.collection("other", createSchema<Item>().build())
  await expect(
    items.count({ name: { $regex: "[" } } as QueryFilter<Item>)
  ).rejects.toBeInstanceOf(QueryError)
  expect(registrations).toBe(1)
})
