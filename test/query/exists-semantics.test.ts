import { expect, test } from "bun:test"
import { createSchema, type Document, Strata } from "../../src/index.js"
import { SQLiteQueryTranslator } from "../../src/sqlite-query-translator.js"

type Item = Document<{
  name: string
  nick?: string | null
  profile?: { nick?: string | null }
}>

for (const indexed of [false, true]) {
  for (const enableCache of [false, true]) {
    for (const first of [false, true]) {
      test(`[TASK-263] exists indexed=${indexed}, cache=${enableCache}, first=${first}`, async () => {
        using db = new Strata({ database: ":memory:", enableCache })
        const items = db.collection(
          "items",
          createSchema<Item>()
            .field("nick", { type: "TEXT", indexed })
            .field("profile.nick", { type: "TEXT", indexed })
            .build()
        )
        await items.insertMany([
          { name: "null", nick: null, profile: { nick: null } },
          { name: "missing" },
          { name: "empty-parent", profile: {} },
          { name: "a", nick: "Alice", profile: { nick: "Alice" } },
          { name: "b", nick: "Bob", profile: { nick: "Bob" } },
        ])
        for (let pass = 0; pass < 2; pass += 1) {
          for (const exists of [first, !first]) {
            for (const field of ["nick", "profile.nick"]) {
              expect(
                (await items.find({ [field]: { $exists: exists } }))
                  .map((item) => item.name)
                  .sort()
              ).toEqual(
                exists ? ["a", "b", "null"] : ["empty-parent", "missing"]
              )
            }
          }
          for (const name of ["a", "b"]) {
            expect(
              (
                await items.find({
                  nick: { $exists: true, $eq: name === "a" ? "Alice" : "Bob" },
                  name,
                })
              ).map((item) => item.name)
            ).toEqual([name])
            expect(
              (
                await items.find({
                  nick: { $eq: name === "a" ? "Alice" : "Bob", $exists: true },
                  name,
                })
              ).map((item) => item.name)
            ).toEqual([name])
          }
          expect(await items.count({ _id: { $exists: true } })).toBe(5)
          expect(await items.count({ _id: { $exists: false } })).toBe(0)
        }
      })
    }
  }
}

test("[TASK-263] exists boolean values select distinct cached SQL templates", () => {
  type Counter = Document<{ count: number }>
  const translator = new SQLiteQueryTranslator(
    createSchema<Counter>().build(),
    { enableCache: true }
  )
  expect(translator.translate({ count: { $exists: true } }).sql).toContain(
    "IS NOT NULL"
  )
  expect(translator.translate({ count: { $exists: false } }).sql).toContain(
    "IS NULL"
  )
  expect(translator.translate({ count: { $exists: true } }).sql).toContain(
    "IS NOT NULL"
  )
})
