import { expect, test } from "bun:test"
import { createSchema, type Document, Strata } from "../../src/index.js"

type Item = Document<{ name: string; nick?: string | null }>

for (const indexed of [false, true]) {
  for (const enableCache of [false, true]) {
    test(`A11 [TASK-237] scalar null semantics indexed=${indexed}, cache=${enableCache}`, async () => {
      using db = new Strata({ database: ":memory:", enableCache })
      const items = db.collection(
        "items",
        createSchema<Item>().field("nick", { type: "TEXT", indexed }).build()
      )
      await items.insertMany([
        { name: "null", nick: null },
        { name: "missing" },
        { name: "a", nick: "A" },
        { name: "b", nick: "B" },
      ])
      const cases = [
        { filter: { nick: null }, expected: ["missing", "null"] },
        { filter: { nick: { $eq: null } }, expected: ["missing", "null"] },
        { filter: { nick: { $ne: null } }, expected: ["a", "b"] },
        { filter: { nick: { $ne: "A" } }, expected: ["b", "missing", "null"] },
        { filter: { nick: { $ne: "B" } }, expected: ["a", "missing", "null"] },
        {
          filter: { nick: { $nin: ["A"] } },
          expected: ["b", "missing", "null"],
        },
        {
          filter: { nick: { $nin: ["B"] } },
          expected: ["a", "missing", "null"],
        },
        {
          filter: { nick: { $nin: [] } },
          expected: ["a", "b", "missing", "null"],
        },
        { filter: { nick: { $nin: [null] } }, expected: ["a", "b"] },
        { filter: { nick: { $nin: [null, "A"] } }, expected: ["b"] },
        { filter: { nick: { $nin: [null, "B"] } }, expected: ["a"] },
        {
          filter: { nick: { $eq: null }, name: { $ne: "null" } },
          expected: ["missing"],
        },
        {
          filter: { nick: { $eq: null }, name: { $ne: "missing" } },
          expected: ["null"],
        },
        { filter: { nick: { $ne: null, $nin: ["A"] } }, expected: ["b"] },
        { filter: { nick: { $ne: null, $nin: ["B"] } }, expected: ["a"] },
      ]
      for (let pass = 0; pass < 2; pass += 1) {
        for (const { filter, expected } of cases) {
          expect(
            (await items.find(filter as never)).map((item) => item.name).sort()
          ).toEqual(expected)
        }
      }
      const result = await items.updateMany(
        { nick: { $ne: "A" } },
        { name: "updated" }
      )
      expect(result.modifiedCount).toBe(3)
    })
  }
}
