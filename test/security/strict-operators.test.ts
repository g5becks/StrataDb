import { expect, test } from "bun:test"
import { InvalidQueryOperatorError } from "../../src/errors.js"
import {
  createSchema,
  type Document,
  QueryError,
  Strata,
} from "../../src/index.js"

type Item = Document<{ name: string; count: number; values: number[] }>

const unknownFilters = [
  { name: { $eqq: "kept" } },
  { $unknown: [] },
  { $and: [{ name: { $eqq: "kept" } }] },
  { $or: [{ name: "kept" }, { $unknown: true }] },
  { $not: { name: { $eqq: "kept" } } },
  { values: { $elemMatch: { $eqq: 1 } } },
  { values: { $elemMatch: { field: { $eqq: 1 } } } },
  { values: { $index: { index: 0, condition: { $eqq: 1 } } } },
]

for (const input of unknownFilters) {
  test(`A2 [TASK-229] every filter method rejects ${JSON.stringify(input)}`, async () => {
    using db = new Strata({ database: ":memory:" })
    const items = db.collection("items", createSchema<Item>().build())
    await items.insertOne({ name: "kept", count: 1, values: [1] })
    const filter = input as never
    const operations = [
      () => items.find(filter),
      () => items.findOne(filter),
      () => items.count(filter),
      () => items.updateOne(filter, { count: 2 }),
      () => items.replaceOne(filter, { name: "changed", count: 2, values: [] }),
      () => items.updateMany(filter, { count: 2 }),
      () => items.deleteOne(filter),
      () => items.deleteMany(filter),
      () => items.findOneAndUpdate(filter, { count: 2 }),
      () =>
        items.findOneAndReplace(filter, {
          name: "changed",
          count: 2,
          values: [],
        }),
      () => items.findOneAndDelete(filter),
      () => items.distinct("name", filter),
    ]
    for (const operation of operations) {
      await expect(Promise.resolve().then(operation)).rejects.toBeInstanceOf(
        InvalidQueryOperatorError
      )
      expect(await items.count({})).toBe(1)
      expect(await items.findOne({ name: "kept" })).toMatchObject({
        count: 1,
        values: [1],
      })
    }
  })
}

const malformedFilters = [
  { count: { $in: "1" } },
  { count: { $nin: null } },
  { values: { $all: 1 } },
  { values: { $size: -1 } },
  { values: { $size: 0.5 } },
  { name: { $exists: "true" } },
  ...["$like", "$ilike", "$contains", "$startsWith", "$endsWith"].map((op) => ({
    name: { [op]: 1 },
  })),
  { values: { $elemMatch: [] } },
  { values: { $elemMatch: {} } },
  { values: { $index: null } },
  { values: { $index: { index: 0 } } },
  { values: { $index: { index: 0, condition: {} } } },
  { values: { $index: { index: 0, condition: 1, extra: true } } },
  { name: {} },
  { name: { ordinaryKey: "silently ignored" } },
  { $and: "invalid" },
  { $or: [null] },
  { $nor: {} },
  { $not: [] },
]

for (const input of malformedFilters) {
  test(`A2 [TASK-229] malformed shape rejects ${JSON.stringify(input)}`, async () => {
    using db = new Strata({ database: ":memory:" })
    const items = db.collection("items", createSchema<Item>().build())
    await items.insertOne({ name: "kept", count: 1, values: [1] })
    await expect(
      Promise.resolve().then(() => items.deleteMany(input as never))
    ).rejects.toBeInstanceOf(QueryError)
    expect(await items.count({})).toBe(1)
  })
}

test("A2 [TASK-229] cache hits cannot bypass value validation", async () => {
  using db = new Strata({ database: ":memory:", enableCache: true })
  const items = db.collection("items", createSchema<Item>().build())
  await items.insertOne({ name: "kept", count: 1, values: [1] })
  expect(await items.count({ values: { $size: 1 } })).toBe(1)
  await expect(
    Promise.resolve().then(() => items.deleteMany({ values: { $size: -1 } }))
  ).rejects.toBeInstanceOf(QueryError)
  expect(await items.count({})).toBe(1)
})
