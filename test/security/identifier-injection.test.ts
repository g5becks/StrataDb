import { expect, test } from "bun:test"
import {
  createSchema,
  type Document,
  QueryError,
  Strata,
} from "../../src/index.js"

type Item = Document<{
  name: string
  profile?: { city: string }
  values?: number[]
}>

const payloads = [
  "x') IS NULL OR 1=1 OR jsonb_extract(body,'$.x",
  'name"; DROP TABLE items; --',
  "name; DELETE FROM items",
  "name--",
  "name/*comment*/",
  "name[0]",
  "name..value",
  "",
  "name\0value",
  "name value",
]

for (const payload of payloads) {
  test(`A1 [TASK-228] identifier corpus ${JSON.stringify(payload)}`, async () => {
    using db = new Strata({ database: ":memory:" })
    const items = db.collection(
      "items",
      createSchema<Item>()
        .field("name", { type: "TEXT", indexed: true })
        .build()
    )
    await items.insertMany([{ name: "kept" }, { name: "also kept" }])
    const operations = [
      () => items.find({ [payload]: "x" } as never),
      () => items.count({ [payload]: "x" } as never),
      () => items.deleteMany({ [payload]: "x" } as never),
      () => items.updateMany({ [payload]: "x" } as never, { name: "damaged" }),
      () => items.find({}, { sort: { [payload]: 1 } } as never),
      () => items.find({}, { search: { text: "kept", fields: [payload] } }),
      () =>
        items.find({}, {
          sort: { [payload]: 1 },
          cursor: { after: "unknown" },
        } as never),
      () => items.distinct(payload as never),
      () =>
        db.collection(
          "invalid_schema",
          createSchema<Item>()
            .field(payload, { type: "TEXT", indexed: true })
            .build()
        ),
    ]
    for (const operation of operations) {
      await expect(Promise.resolve().then(operation)).rejects.toBeInstanceOf(
        QueryError
      )
      expect((await items.find({})).map((item) => item.name).sort()).toEqual([
        "also kept",
        "kept",
      ])
    }
  })
}

for (const value of [
  "0 UNION SELECT 1",
  "1; DROP TABLE items",
  -1,
  0.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.MAX_SAFE_INTEGER + 1,
  null,
  false,
]) {
  test(`A1 [TASK-228] numeric corpus ${String(value)}`, async () => {
    using db = new Strata({ database: ":memory:" })
    const items = db.collection("items", createSchema<Item>().build())
    await items.insertOne({ name: "kept", values: [1, 2] })
    for (const options of [{ limit: value }, { skip: value }]) {
      await expect(
        Promise.resolve().then(() => items.find({}, options as never))
      ).rejects.toBeInstanceOf(QueryError)
    }
    await expect(
      Promise.resolve().then(() =>
        items.find({
          values: { $index: { index: value, condition: 1 } },
        } as never)
      )
    ).rejects.toBeInstanceOf(QueryError)
    expect(await items.count({})).toBe(1)
  })
}

test("A16 [TASK-228] collection names are quoted as complete identifiers", async () => {
  using db = new Strata({ database: ":memory:" })
  for (const name of ["order", "user-data", 'items"; DROP TABLE users;--']) {
    const items = db.collection(name, createSchema<Item>().build())
    const inserted = await items.insertOne({ name: "kept" })
    expect((await items.findById(inserted._id))?.name).toBe("kept")
    await items.drop()
  }
  expect(() => db.collection("", createSchema<Item>().build())).toThrow()
  expect(() => db.collection("bad\0name")).toThrow()
})

test("A1 [TASK-228] repeated bound paths, cache hits, distinct, sort and cursor preserve binding order", async () => {
  using db = new Strata({ database: ":memory:", enableCache: true })
  const items = db.collection("items", createSchema<Item>().build())
  await items.insertMany([
    { _id: "a", name: "alpha", values: [1, 2], profile: { city: "Austin" } },
    { _id: "b", name: "beta", values: [2, 3], profile: { city: "Boston" } },
  ])
  for (const [lower, upper, expected] of [
    ["a", "az", "alpha"],
    ["b", "bz", "beta"],
  ] as const) {
    expect(
      (await items.find({ name: { $gte: lower, $lt: upper } })).map(
        (item) => item.name
      )
    ).toEqual([expected])
  }
  expect(await items.distinct("name", { "profile.city": "Boston" })).toEqual([
    "beta",
  ])
  expect(
    (await items.find({ values: { $all: [1, 2] } })).map((item) => item.name)
  ).toEqual(["alpha"])
  expect(
    (
      await items.find({
        values: { $index: { index: 0, condition: { $gte: 2, $lt: 3 } } },
      })
    ).map((item) => item.name)
  ).toEqual(["beta"])
  expect(
    (
      await items.find(
        {},
        { sort: { name: 1 }, cursor: { after: "a" }, limit: 1 }
      )
    ).map((item) => item.name)
  ).toEqual(["beta"])
  expect(
    (
      await items.find(
        {},
        { search: { text: "beta", fields: ["name"] }, sort: { name: -1 } }
      )
    ).map((item) => item.name)
  ).toEqual(["beta"])
  expect(
    (await items.find({ name: "alpha", "profile.city": "Austin" })).map(
      (item) => item.name
    )
  ).toEqual(["alpha"])
  expect(
    (await items.find({ "profile.city": "Boston", name: "beta" })).map(
      (item) => item.name
    )
  ).toEqual(["beta"])
})

test("A16 [TASK-228] dotted generated fields have distinct safe identifiers", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection(
    "nested",
    createSchema<Item>()
      .field("profile.city", { type: "TEXT", indexed: true })
      .build()
  )
  await items.insertOne({ name: "kept", profile: { city: "Boston" } })
  expect(
    (await items.find({ "profile.city": "Boston" })).map((item) => item.name)
  ).toEqual(["kept"])
})
