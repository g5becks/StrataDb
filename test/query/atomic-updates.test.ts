import { expect, test } from "bun:test"
import {
  createSchema,
  type Document,
  QueryError,
  Strata,
  ValidationError,
} from "../../src/index.js"

type Item = Document<{
  name: string
  count: number
  nested: { n?: number; label?: string }
  tags: unknown[]
}>
const schema = createSchema<Item>()
  .field("count", { type: "INTEGER", indexed: true })
  .build()

test("[TASK-249] each atomic operator executes one real JSONB UPDATE", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", schema)
  await items.insertOne({
    _id: "a",
    name: "a",
    count: 0,
    nested: { n: 1 },
    tags: ["x", "x", { id: 1, meta: { a: 2 } }],
  })
  const statements: string[] = []
  const prepare = db.sqliteDb.prepare
  Object.defineProperty(db.sqliteDb, "prepare", {
    value(sql: string, ...args: unknown[]) {
      statements.push(sql)
      return Reflect.apply(prepare, this, [sql, ...args])
    },
  })
  for (const [update, expectedFunction] of [
    [{ $set: { "nested.label": "value" } }, "jsonb_set"],
    [{ $unset: { "nested.n": true } }, "jsonb_remove"],
    [{ $inc: { count: 2 } }, "jsonb_set"],
    [{ $push: { tags: "new" } }, "jsonb_insert"],
    [{ $pull: { tags: { meta: { a: 2 }, id: 1 } } }, "jsonb_group_array"],
  ] as const) {
    statements.length = 0
    await items.updateOne("a", update as never)
    const updates = statements.filter((sql) => sql.startsWith("UPDATE "))
    expect(updates).toHaveLength(1)
    expect(updates[0]).toContain(expectedFunction)
  }
  expect(await items.findOne("a")).toMatchObject({
    count: 2,
    nested: { label: "value" },
    tags: ["x", "x", "new"],
  })
  await items.updateOne("a", { $pull: { tags: "x" } } as never)
  expect((await items.findOne("a"))?.tags).toEqual(["new"])
})

test("[TASK-249] 100 concurrent real SQLite increments produce exactly +100", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", schema)
  await items.insertOne({
    _id: "counter",
    name: "counter",
    count: 0,
    nested: {},
    tags: [],
  })
  const results = await Promise.all(
    Array.from({ length: 100 }, () =>
      items.updateOne("counter", { $inc: { count: 1, "nested.n": 1 } } as never)
    )
  )
  expect(
    results.map((item) => item?.count).sort((a, b) => Number(a) - Number(b))
  ).toEqual(Array.from({ length: 100 }, (_, index) => index + 1))
  expect(await items.findOne("counter")).toMatchObject({
    count: 100,
    nested: { n: 100 },
  })
})

test("[TASK-249] batch operators use one UPDATE and retain actual event IDs", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", schema)
  await items.insertMany([
    { _id: "a", name: "a", count: 1, nested: {}, tags: [] },
    { _id: "b", name: "b", count: 2, nested: {}, tags: [] },
  ])
  const statements: string[] = []
  const prepare = db.sqliteDb.prepare
  Object.defineProperty(db.sqliteDb, "prepare", {
    value(sql: string, ...args: unknown[]) {
      statements.push(sql)
      return Reflect.apply(prepare, this, [sql, ...args])
    },
  })
  const ids: string[][] = []
  items.on("updateMany", (event) => ids.push([...event.ids]))
  expect(
    await items.updateMany({}, {
      $inc: { count: 2 },
      $push: { tags: { ok: true } },
    } as never)
  ).toEqual({ matchedCount: 2, modifiedCount: 2 })
  expect(statements.filter((sql) => sql.startsWith("UPDATE "))).toHaveLength(1)
  expect(ids[0]?.sort()).toEqual(["a", "b"])
  expect(
    (await items.find({}, { sort: { _id: 1 } })).map((item) => item.count)
  ).toEqual([3, 4])
  expect((await items.findOne("a"))?.tags).toEqual([{ ok: true }])
})

test("[TASK-249] operator upserts, before/after returns and plain merges coexist", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", schema)
  const upserted = await items.updateOne(
    { name: "new", count: 10 },
    { $inc: { count: 2 }, $set: { nested: { n: 1 }, tags: [] } } as never,
    { upsert: true }
  )
  expect(upserted).toMatchObject({
    name: "new",
    count: 12,
    nested: { n: 1 },
    tags: [],
  })
  const before = await items.findOneAndUpdate(
    upserted?._id ?? "",
    { $inc: { count: 1 } } as never,
    { returnDocument: "before" }
  )
  expect(before?.count).toBe(12)
  const merged = await items.updateOne(upserted?._id ?? "", {
    nested: { label: "plain" },
  })
  expect(merged).toMatchObject({ count: 13, nested: { n: 1, label: "plain" } })
  await items.updateOne(upserted?._id ?? "", {
    $unset: { "nested.label": true },
  } as never)
  expect((await items.findOne(upserted?._id ?? ""))?.nested).toEqual({ n: 1 })
})

test("[TASK-249] operator validation is atomic and rollback discards events", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection(
    "items",
    createSchema<Item>()
      .validate(
        (doc): doc is Item =>
          typeof doc === "object" && doc !== null && (doc as Item).count < 3
      )
      .build()
  )
  await items.insertMany([
    { _id: "a", name: "a", count: 1, nested: {}, tags: [] },
    { _id: "b", name: "b", count: 2, nested: {}, tags: [] },
  ])
  let events = 0
  items.on("updateMany", () => {
    events += 1
  })
  await expect(
    items.updateMany({}, { $inc: { count: 1 } } as never)
  ).rejects.toBeInstanceOf(ValidationError)
  expect(
    (await items.find({}, { sort: { _id: 1 } })).map((item) => item.count)
  ).toEqual([1, 2])
  await expect(
    db.execute(async () => {
      await items.updateMany({}, { $set: { name: "changed" } } as never)
      expect(events).toBe(0)
      throw new Error("rollback")
    })
  ).rejects.toThrow("rollback")
  expect(events).toBe(0)
  expect(
    (await items.find({}, { sort: { _id: 1 } })).map((item) => item.name)
  ).toEqual(["a", "b"])
})

test("[TASK-249] malformed operators, overlapping/metadata/injected paths reject", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", schema)
  await items.insertOne({ _id: "a", name: "a", count: 0, nested: {}, tags: [] })
  const malformed = [
    { name: "bad", $inc: { count: 1 } },
    { $unknown: { count: 1 } },
    { $inc: { count: "1" } },
    { $inc: { name: 1 } },
    { $push: { count: 1 } },
    { $pull: { count: 1 } },
    { $set: { nested: {}, "nested.n": 1 } },
    { $set: { count: 1 }, $inc: { count: 2 } },
    { $set: { _id: "bad" } },
    { $unset: { createdAt: true } },
  ]
  for (const update of malformed) {
    await expect(items.updateOne("a", update as never)).rejects.toBeInstanceOf(
      QueryError
    )
  }
  for (const op of ["$set", "$unset", "$inc", "$push", "$pull"]) {
    await expect(
      items.updateOne("a", { [op]: { "bad') OR 1=1--": 1 } } as never)
    ).rejects.toBeInstanceOf(QueryError)
  }
  expect(await items.findOne("a")).toMatchObject({
    name: "a",
    count: 0,
    nested: {},
    tags: [],
  })
})

test("[TASK-249] pull preserves JSON types and array order while ignoring object key order", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", schema)
  await items.insertOne({
    _id: "a",
    name: "a",
    count: 0,
    nested: {},
    tags: [
      1,
      true,
      null,
      "1",
      { a: 1, b: [2, 3] },
      { b: [2, 3], a: 1 },
      [1, 2],
      [2, 1],
    ],
  })
  for (const target of [{ b: [2, 3], a: 1 }, true, null, [1, 2]]) {
    await items.updateOne("a", { $pull: { tags: target } } as never)
  }
  expect((await items.findOne("a"))?.tags).toEqual([1, "1", [2, 1]])
  await items.updateOne("a", { $pull: { missing: "value" } } as never)
  expect(await items.findOne("a")).not.toHaveProperty("missing")
})

test("[TASK-249] paths cannot pollute prototypes and invalid parents cannot lose writes", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", schema)
  await items.insertOne({
    _id: "a",
    name: "a",
    count: 0,
    nested: null,
    tags: [],
  } as never)
  await expect(
    items.updateOne("a", { $set: { "nested.n": 2 } } as never)
  ).rejects.toBeInstanceOf(QueryError)
  await items.updateOne("a", {
    $set: { "__proto__.strataPolluted": "safe-data" },
  } as never)
  expect(
    (Object.prototype as { strataPolluted?: unknown }).strataPolluted
  ).toBeUndefined()
  const row = await items.findOne("a")
  expect(Object.hasOwn(row ?? {}, "__proto__")).toBe(true)
  expect(row).toMatchObject({ count: 0, nested: null })
})

test("[TASK-249] concurrent operator upserts preserve dotted equality filters", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", schema)
  await Promise.all(
    Array.from({ length: 10 }, () =>
      items.updateOne(
        { name: "seed", "nested.label": "seed" },
        { $inc: { count: 1 }, $set: { tags: [] } } as never,
        { upsert: true }
      )
    )
  )
  expect(await items.count({ name: "seed" })).toBe(1)
  expect(await items.findOne({ "nested.label": "seed" })).toMatchObject({
    name: "seed",
    count: 10,
    nested: { label: "seed" },
  })
})
