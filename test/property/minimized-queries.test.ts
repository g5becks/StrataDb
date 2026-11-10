import { expect, test } from "bun:test"
import { createSchema, type Document, Strata } from "../../src/index.js"

type Item = Document<{ n?: number | null; nums: (number | null)[] }>
const cases = [
  { name: "empty OR matches nothing", filter: { $or: [] }, expected: [] },
  {
    name: "IN null matches null and missing",
    filter: { n: { $in: [null] } },
    expected: ["a", "b"],
  },
  {
    name: "ALL null matches actual null array elements",
    filter: { nums: { $all: [null] } },
    expected: ["a"],
  },
  {
    name: "index null requires an existing element",
    filter: { nums: { $index: { index: 0, condition: null } } },
    expected: ["a"],
  },
  {
    name: "index NE excludes absent elements",
    filter: { nums: { $index: { index: 3, condition: { $ne: 1 } } } },
    expected: [],
  },
  {
    name: "index exists includes null elements",
    filter: { nums: { $index: { index: 0, condition: { $exists: true } } } },
    expected: ["a", "c"],
  },
  {
    name: "index exists false does not invent missing elements",
    filter: { nums: { $index: { index: 0, condition: { $exists: false } } } },
    expected: [],
  },
]
for (const indexed of [false, true]) {
  for (const enableCache of [false, true]) {
    for (const example of cases) {
      test(`[TASK-251] ${example.name}; indexed=${indexed}, cache=${enableCache}`, async () => {
        using db = new Strata({ database: ":memory:", enableCache })
        const items = db.collection(
          "items",
          createSchema<Item>()
            .field("n", { type: "REAL", indexed })
            .field("nums", { type: "BLOB", indexed })
            .build()
        )
        await items.insertMany([
          { _id: "a", n: null, nums: [null] },
          { _id: "b", nums: [] },
          { _id: "c", n: 1, nums: [1] },
        ])
        for (let pass = 0; pass < 2; pass += 1) {
          expect(
            (
              await items.find(example.filter as never, { sort: { _id: 1 } })
            ).map((item) => item._id)
          ).toEqual(example.expected)
        }
      })
    }
  }
}
