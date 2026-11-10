import { expect, test } from "bun:test"
import {
  createSchema,
  type Document,
  InvalidQueryOperatorError,
  QueryError,
  Strata,
} from "../../src/index.js"

type Item = Document<{ name: string; items: unknown; values: unknown }>
const documents = [
  {
    name: "a",
    items: [
      {
        sku: "X",
        qty: 2,
        nick: null,
        meta: { color: "red" },
        children: [{ score: 3 }],
      },
    ],
    values: [1, 3],
  },
  {
    name: "b",
    items: [
      { sku: "X", qty: 1 },
      { sku: "Y", qty: 3, nick: "Bob" },
    ],
    values: [2],
  },
  { name: "c", items: [], values: [] },
  {
    name: "d",
    items: [null, "text", 7, { qty: 0, children: "invalid-array" }],
    values: [null, "text", 4],
  },
  { name: "e", items: "not-json", values: null },
  {
    name: "f",
    items: [],
    values: [
      [1, 2],
      [3, 4],
    ],
  },
]
const cases = [
  {
    name: "one object satisfies every condition",
    filter: { items: { $elemMatch: { sku: "X", qty: { $gte: 2 } } } },
    expected: ["a"],
  },
  {
    name: "numeric operators",
    filter: { items: { $elemMatch: { qty: { $gte: 2 } } } },
    expected: ["a", "b"],
  },
  {
    name: "nested paths",
    filter: { items: { $elemMatch: { "meta.color": "red" } } },
    expected: ["a"],
  },
  {
    name: "present including null",
    filter: { items: { $elemMatch: { nick: { $exists: true } } } },
    expected: ["a", "b"],
  },
  {
    name: "missing object fields",
    filter: { items: { $elemMatch: { nick: { $exists: false } } } },
    expected: ["b", "d"],
  },
  {
    name: "null or missing",
    filter: { items: { $elemMatch: { nick: null } } },
    expected: ["a", "b", "d"],
  },
  {
    name: "nested object arrays",
    filter: {
      items: {
        $elemMatch: { children: { $elemMatch: { score: { $gte: 2 } } } },
      },
    },
    expected: ["a"],
  },
  {
    name: "logical branches",
    filter: { items: { $elemMatch: { $or: [{ sku: "Y" }, { qty: 0 }] } } },
    expected: ["b", "d"],
  },
  {
    name: "logical negation",
    filter: { items: { $elemMatch: { $not: { sku: "X" } } } },
    expected: ["b", "d"],
  },
  {
    name: "logical nor includes missing comparisons",
    filter: { items: { $elemMatch: { $nor: [{ sku: "X" }] } } },
    expected: ["b", "d"],
  },
  {
    name: "scalar numeric range",
    filter: { values: { $elemMatch: { $gte: 3, $lte: 5 } } },
    expected: ["a", "d"],
  },
  {
    name: "scalar string operator",
    filter: { values: { $elemMatch: { $contains: "ex" } } },
    expected: ["d"],
  },
  {
    name: "scalar null",
    filter: { values: { $elemMatch: { $eq: null } } },
    expected: ["d"],
  },
  {
    name: "nested scalar arrays",
    filter: { values: { $elemMatch: { $elemMatch: { $eq: 4 } } } },
    expected: ["f"],
  },
]

for (const indexed of [false, true]) {
  for (const enableCache of [false, true]) {
    for (const example of cases) {
      test(`A12 [TASK-245] ${example.name}; indexed=${indexed}, cache=${enableCache}`, async () => {
        using db = new Strata({ database: ":memory:", enableCache })
        const items = db.collection(
          "items",
          createSchema<Item>()
            .field("items", { type: "BLOB", indexed })
            .field("values", { type: "BLOB", indexed })
            .build()
        )
        await items.insertMany(documents)
        for (let pass = 0; pass < 2; pass += 1) {
          expect(
            (await items.find(example.filter as never))
              .map((item) => item.name)
              .sort()
          ).toEqual(example.expected)
        }
      })
    }
  }
}

test("[TASK-245] element paths, logical shapes and unknown operators are validated", async () => {
  using db = new Strata({ database: ":memory:", enableCache: true })
  const items = db.collection("items", createSchema<Item>().build())
  await items.insertMany(documents)
  await expect(
    items.find({ items: { $elemMatch: { "bad') OR 1=1--": 1 } } } as never)
  ).rejects.toBeInstanceOf(QueryError)
  await expect(
    items.find({
      items: { $elemMatch: { $or: [{ qty: { $eqq: 2 } }] } },
    } as never)
  ).rejects.toBeInstanceOf(InvalidQueryOperatorError)
  await expect(
    items.find({ items: { $elemMatch: { $or: "invalid" } } } as never)
  ).rejects.toBeInstanceOf(QueryError)
  expect(await items.count({})).toBe(documents.length)
})
