import { expect, test } from "bun:test"
import fc from "fast-check"
import {
  createSchema,
  type Document,
  QueryError,
  Strata,
} from "../../src/index.js"

type Item = Document<{
  rank?: number | null | undefined
  group?: string | null | undefined
  profile: { rank?: number | null | undefined }
}>
type Key = "rank" | "group" | "profile.rank" | "_id"
type Entry = readonly [Key, 1 | -1]

function value(item: Item, key: Key): number | string | null {
  if (key === "profile.rank") {
    return item.profile.rank ?? null
  }
  return item[key] ?? null
}
function compare(left: Item, right: Item, entries: readonly Entry[]): number {
  for (const [key, direction] of entries) {
    const a = value(left, key)
    const b = value(right, key)
    if (a === b) {
      continue
    }
    if (a === null) {
      return -direction
    }
    if (b === null) {
      return direction
    }
    return (a < b ? -1 : 1) * direction
  }
  return 0
}

const scalar = fc.constantFrom(null, undefined, -1, 0, 1, 2)
const data = fc.array(
  fc.record({
    rank: scalar,
    group: fc.constantFrom(null, undefined, "A", "B"),
    profile: fc.record({ rank: scalar }),
  }),
  { minLength: 1, maxLength: 30 }
)
const sorts = fc.uniqueArray(
  fc.tuple(
    fc.constantFrom<Key>("rank", "group", "profile.rank", "_id"),
    fc.constantFrom<1 | -1>(1, -1)
  ),
  { minLength: 1, maxLength: 4, selector: ([key]) => key }
)

test("A15 [TASK-246] seeded multi-key cursor walks match a reference ordering exactly", async () => {
  await fc.assert(
    fc.asyncProperty(
      data,
      sorts,
      fc.integer({ min: 1, max: 7 }),
      fc.boolean(),
      async (input, entries, size, indexed) => {
        using db = new Strata({ database: ":memory:", enableCache: true })
        const items = db.collection(
          "items",
          createSchema<Item>()
            .field("rank", { type: "INTEGER", indexed })
            .field("group", { type: "TEXT", indexed })
            .field("profile.rank", { type: "INTEGER", indexed })
            .build()
        )
        const records = input.map((item, index) => ({
          ...item,
          _id: `row-${String(index).padStart(3, "0")}`,
        }))
        await items.insertMany(records.toReversed())
        const stable: Entry[] = entries.some(([key]) => key === "_id")
          ? entries
          : [...entries, ["_id", 1]]
        const expected = records
          .toSorted((a, b) => compare(a, b, stable))
          .map((item) => item._id)
        const sort = Object.fromEntries(entries)
        const forward: string[] = []
        let after: string | undefined
        for (let page = 0; page <= records.length; page += 1) {
          const rows = await items.find(
            {},
            { sort, limit: size, ...(after ? { cursor: { after } } : {}) }
          )
          if (!rows.length) {
            break
          }
          forward.push(...rows.map((row) => row._id))
          after = rows.at(-1)?._id
        }
        expect(forward).toEqual(expected)
        expect(new Set(forward).size).toBe(records.length)
        const last = await items.find(
          {},
          { sort, skip: Math.max(0, records.length - size) }
        )
        const backward = last.map((row) => row._id)
        let before = last[0]?._id
        for (let page = 0; before && page <= records.length; page += 1) {
          const rows = await items.find(
            {},
            { sort, limit: size, cursor: { before } }
          )
          if (!rows.length) {
            break
          }
          backward.unshift(...rows.map((row) => row._id))
          before = rows[0]?._id
        }
        expect(backward).toEqual(expected)
      }
    ),
    { seed: 20_261_109, numRuns: 250 }
  )
})

test("[TASK-246] malformed and unknown cursors reject", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", createSchema<Item>().build())
  await items.insertOne({ _id: "a", rank: 1, group: "A", profile: {} })
  for (const options of [
    { sort: { rank: 1 }, cursor: { after: "unknown" } },
    { cursor: { after: "a" } },
    { sort: {}, cursor: { after: "a" } },
    { sort: { rank: 1 }, cursor: {} },
    { sort: { rank: 1 }, cursor: { after: "" } },
    { sort: { rank: 1 }, cursor: { after: "a", before: "a" } },
  ]) {
    await expect(items.find({}, options as never)).rejects.toBeInstanceOf(
      QueryError
    )
  }
})
