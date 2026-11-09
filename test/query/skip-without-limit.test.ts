import { expect, test } from "bun:test"
import { createSchema, type Document, Strata } from "../../src/index.js"

test("A14 [TASK-239] skip-only and explicit limits preserve pagination and binding order", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection(
    "items",
    createSchema<Document<{ value: number }>>().build()
  )
  await items.insertMany([0, 1, 2, 3].map((value) => ({ value })))
  for (const [skip, expected] of [
    [0, [0, 1, 2, 3]],
    [1, [1, 2, 3]],
    [4, []],
    [100, []],
  ] as const) {
    expect(
      (await items.find({}, { sort: { value: 1 }, skip })).map(
        (item) => item.value
      )
    ).toEqual(expected)
  }
  expect(
    (
      await items.find({ value: { $gte: 1 } }, { sort: { value: -1 }, skip: 1 })
    ).map((item) => item.value)
  ).toEqual([2, 1])
  expect(await items.find({}, { skip: 1, limit: 0 })).toEqual([])
  expect(
    (await items.find({}, { sort: { value: 1 }, skip: 1, limit: 2 })).map(
      (item) => item.value
    )
  ).toEqual([1, 2])
})
