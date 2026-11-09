import { expect, test } from "bun:test"
import {
  createSchema,
  type Document,
  Strata,
  UniqueConstraintError,
} from "../../src/index.js"
import { SQLiteQueryTranslator } from "../../src/sqlite-query-translator.js"

type Item = Document<{
  tenant: string
  profile: { city: string }
  value: number
}>

test("A8 [TASK-235] dotted compound index has ordered columns and is used by translated queries", async () => {
  using db = new Strata({ database: ":memory:" })
  const schema = createSchema<Item>()
    .field("tenant", { type: "TEXT", indexed: true })
    .field("profile.city", { type: "TEXT", indexed: true })
    .compoundIndex("tenant_city", ["tenant", "profile.city"])
    .build()
  const items = db.collection("records", schema)
  await items.insertMany([
    { tenant: "one", profile: { city: "Austin" }, value: 1 },
    { tenant: "one", profile: { city: "Boston" }, value: 2 },
    { tenant: "two", profile: { city: "Austin" }, value: 3 },
  ])
  const index = db.sqliteDb
    .query<{ name: string }, []>(
      "SELECT name FROM pragma_index_list('records')"
    )
    .all()
    .find((entry) => entry.name.includes("tenant_city"))
  expect(index).toBeDefined()
  if (!index) {
    throw new Error("compound index missing")
  }
  const columns = db.sqliteDb
    .query<{ name: string }, [string]>(
      "SELECT name FROM pragma_index_xinfo(?) WHERE key = 1 ORDER BY seqno"
    )
    .all(index.name)
  expect(columns.map((column) => column.name)).toEqual([
    "_tenant",
    "_$path_7_profile_4_city",
  ])
  const translated = new SQLiteQueryTranslator(schema).translate({
    tenant: "one",
    "profile.city": "Boston",
  })
  const plan = db.sqliteDb
    .prepare<
      { detail: string },
      (string | number | boolean | bigint | null | Uint8Array)[]
    >(`EXPLAIN QUERY PLAN SELECT _id FROM records WHERE ${translated.sql}`)
    .all(...translated.params)
  expect(plan.map((row) => row.detail).join("\n")).toContain(index.name)
  expect(
    (await items.find({ tenant: "one", "profile.city": "Boston" })).map(
      (doc) => doc.value
    )
  ).toEqual([2])
})

test("A8 [TASK-235] expression compound indexes enforce uniqueness on undeclared nested fields", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection(
    "expressions",
    createSchema<Item>()
      .compoundIndex("tenant_city", ["tenant", "profile.city"], {
        unique: true,
      })
      .build()
  )
  await items.insertOne({
    tenant: "one",
    profile: { city: "Austin" },
    value: 1,
  })
  await expect(
    items.insertOne({ tenant: "one", profile: { city: "Austin" }, value: 2 })
  ).rejects.toBeInstanceOf(UniqueConstraintError)
  expect(await items.count({})).toBe(1)
})

test("A8 [TASK-235] table/index name pairs cannot alias or inject SQL", () => {
  using db = new Strata({ database: ":memory:" })
  const names: string[] = []
  for (const [table, indexName] of [
    ["a_b", "c"],
    ["a", "b_c"],
    ['order"--', 'index"; DROP TABLE a; --'],
  ]) {
    db.collection(
      table,
      createSchema<Item>().compoundIndex(indexName, ["tenant", "value"]).build()
    )
    const indexes = db.sqliteDb
      .query<{ name: string }, [string]>(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL"
      )
      .all(table)
    expect(indexes).toHaveLength(1)
    names.push(...indexes.map((index) => index.name))
  }
  expect(new Set(names).size).toBe(3)
})
