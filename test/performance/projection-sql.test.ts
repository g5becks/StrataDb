import { expect, test } from "bun:test"
import { createSchema, type Document, Strata } from "../../src/index.js"

type Item = Document<{
  name: string
  yes: boolean
  no: boolean
  nil: null
  n: number
  nested: { list: (boolean | null | number)[] }
  list: (string | null)[]
  missing?: string
  "a.b": string
  "quote'key": string
}>
const fixture = {
  _id: "one",
  name: "hello",
  yes: true,
  no: false,
  nil: null,
  n: 1.5,
  nested: { list: [false, null, 2] },
  list: ["x", null],
  "a.b": "literal dot",
  "quote'key": "literal quote",
}

test("[TASK-253] inclusion is computed in SQL with bound keys and filter parameters", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", createSchema<Item>().build())
  await items.insertOne(fixture)
  const prepared: string[] = []
  const native = db.sqliteDb.prepare
  Object.defineProperty(db.sqliteDb, "prepare", {
    value(sql: string, ...args: unknown[]) {
      prepared.push(sql)
      return Reflect.apply(native, this, [sql, ...args])
    },
  })
  expect(
    await items.find(
      { name: "hello" },
      {
        select: ["name", "quote'key"],
        search: { text: "ell", fields: ["name"] },
        sort: { n: -1 },
        limit: 1,
      }
    )
  ).toEqual([{ _id: "one", name: "hello", "quote'key": "literal quote" }])
  const selectedSQL = prepared.find((entry) => entry.startsWith("SELECT "))
  expect(selectedSQL).toContain("json_object")
  expect(selectedSQL).not.toContain("json(body)")
  expect(selectedSQL).not.toContain("quote'key")
})

test("[TASK-253] SQL inclusion preserves JSON types, missing keys, literal names and order", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", createSchema<Item>().build())
  await items.insertOne(fixture)
  const selected = await items.findOne(
    {},
    { select: ["no", "nil", "nested", "list", "yes", "n", "missing", "a.b"] }
  )
  expect(selected).toEqual({
    _id: "one",
    no: false,
    nil: null,
    nested: fixture.nested,
    list: fixture.list,
    yes: true,
    n: 1.5,
    "a.b": "literal dot",
  })
  expect(Object.keys(selected ?? {})).toEqual([
    "_id",
    "no",
    "nil",
    "nested",
    "list",
    "yes",
    "n",
    "a.b",
  ])
  expect(
    await items.findOne({}, { projection: { _id: 0, missing: 1 } })
  ).toEqual({})
  expect(await items.findOne({}, { projection: { _id: 0, yes: 1 } })).toEqual({
    yes: true,
  })
})

for (const timestamps of [true, false]) {
  test(`[TASK-253] metadata projection honors timestamps=${timestamps} and authoritative columns`, async () => {
    using db = new Strata({ database: ":memory:" })
    const items = db.collection(
      "items",
      createSchema<Item>().timestamps(timestamps).build()
    )
    const inserted = await items.insertOne(fixture)
    const full = await items.findById(inserted._id)
    expect(
      await items.findOne({}, { select: ["createdAt", "name", "updatedAt"] })
    ).toEqual(
      timestamps
        ? {
            _id: "one",
            createdAt: full?.createdAt,
            name: "hello",
            updatedAt: full?.updatedAt,
          }
        : { _id: "one", name: "hello" }
    )
    expect(
      await items.findOne(
        {},
        { projection: { _id: 0, createdAt: 1, updatedAt: 1 } }
      )
    ).toEqual(
      timestamps
        ? { createdAt: full?.createdAt, updatedAt: full?.updatedAt }
        : {}
    )
    const omitted = await items.findOne({}, { omit: ["name", "nested"] })
    expect(omitted).not.toHaveProperty("name")
    expect(omitted).not.toHaveProperty("nested")
    expect(omitted).toHaveProperty("yes", true)
    expect(await items.findOne({}, { select: [] })).toEqual(full)
  })
}

test("[TASK-253] wide selections exceed SQLite argument limits safely", async () => {
  using db = new Strata({ database: ":memory:" })
  type Wide = Document<Record<string, string>>
  const items = db.collection("wide", createSchema<Wide>().build())
  const fixtureWide = Object.fromEntries(
    Array.from({ length: 600 }, (_, index) => [
      `field${index}`,
      `value${index}`,
    ])
  )
  await items.insertOne({ _id: "wide", ...fixtureWide })
  const selected = await items.findOne(
    {},
    {
      select: [
        ...Object.keys(fixtureWide),
        "missing",
        'quote"key',
        "slash\\key",
      ],
    }
  )
  expect(selected).toEqual({ _id: "wide", ...fixtureWide })
  expect(Object.keys(selected ?? {})).toEqual([
    "_id",
    ...Object.keys(fixtureWide),
  ])
})

test("[TASK-253] literal projection keys safely include quotes, backslashes and NUL", async () => {
  using db = new Strata({ database: ":memory:" })
  type Names = Document<Record<string, unknown>>
  const items = db.collection("names", createSchema<Names>().build())
  const names = {
    _id: "names",
    'quote"key': true,
    "slash\\key": false,
    "nul\u0000key": null,
    "x'); DROP TABLE names; --": [1],
  }
  await items.insertOne(names)
  expect(await items.findOne({}, { select: Object.keys(names) })).toEqual(names)
  expect(await items.count({})).toBe(1)
})
