import { Database, type Statement } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  ConnectionError,
  createSchema,
  type Document,
  SchemaValidationError,
  Strata,
  UniqueConstraintError,
} from "../../src/index.js"
import { SQLiteBoundary, sqliteOperation } from "../../src/sqlite-boundary.js"

type Item = Document<{ n: number; name: string }>
const schema = createSchema<Item>()
  .field("n", { type: "INTEGER", indexed: true })
  .build()
type Prepared = { sql: string; statement: Statement }
function capture(database: Database): Prepared[] {
  const results: Prepared[] = []
  const native = database.prepare
  Object.defineProperty(database, "prepare", {
    value(sql: string, ...args: unknown[]) {
      const statement = Reflect.apply(native, this, [sql, ...args]) as Statement
      results.push({ sql, statement })
      return statement
    },
  })
  return results
}

test("[TASK-252] repeated SQL reuses a statement with fresh bound values", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", schema)
  await items.insertMany([
    { name: "one", n: 1 },
    { name: "two", n: 2 },
  ])
  const records = capture(db.sqliteDb)
  for (const n of [1, 2, 1, 2]) {
    expect((await items.findOne({ n }))?.name).toBe(n === 1 ? "one" : "two")
  }
  expect(
    records.filter((record) => record.sql.startsWith("SELECT "))
  ).toHaveLength(1)
})

test("[TASK-252] per-collection LRU evicts and finalizes the least recently used statement", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", schema, {
    statementCacheSize: 2,
  } as never)
  await items.insertOne({ name: "one", n: 1 })
  const records = capture(db.sqliteDb)
  await items.findOne({ n: 1 })
  const first = records[0]?.statement
  await items.count({ n: 1 })
  await items.count({ n: 2 })
  await items.find({}, { sort: { name: 1 } })
  expect(first?.isFinalized).toBe(true)
  expect(
    records.filter((record) => record.sql.startsWith("SELECT COUNT"))
  ).toHaveLength(1)
  expect((await items.findOne({ n: 1 }))?.name).toBe("one")
})

test("[TASK-252] DDL and close finalize cached statements across collections", async () => {
  const db = new Strata({ database: ":memory:" })
  try {
    const items = db.collection("items", schema)
    await items.insertOne({ name: "one", n: 1 })
    const records = capture(db.sqliteDb)
    await items.findOne({ n: 1 })
    const first = records[0]?.statement
    db.collection("other", schema)
    expect(first?.isFinalized).toBe(true)
    expect((await items.findOne({ n: 1 }))?.name).toBe("one")
    const last = records.at(-1)?.statement
    db.close()
    expect(last?.isFinalized).toBe(true)
    await expect(items.findOne({ n: 1 })).rejects.toBeInstanceOf(
      ConnectionError
    )
  } finally {
    db.close()
  }
})

test("[TASK-252] drop finalizes statements and invalidates factory cache only on commit", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", schema)
  await items.insertOne({ name: "one", n: 1 })
  const records = capture(db.sqliteDb)
  await items.count({})
  const first = records[0]?.statement
  await expect(
    db.execute(async () => {
      await items.drop()
      throw new Error("rollback")
    })
  ).rejects.toThrow("rollback")
  expect(first?.isFinalized).toBe(true)
  expect(db.collection("items", schema)).toBe(items)
  expect(await items.count({})).toBe(1)
  await items.drop()
  const reopened = db.collection("items", schema)
  expect(reopened).not.toBe(items)
  expect(await reopened.count({})).toBe(0)
})

test("[TASK-252] cached statement failures retain current operation context", () => {
  using db = new Strata({ database: ":memory:" })
  db.collection("items", schema)
  const records = capture(db.sqliteDb)
  const boundary = new SQLiteBoundary(db.sqliteDb, "items", 2)
  const sql =
    "INSERT INTO items (_id, body, createdAt, updatedAt) VALUES (?, jsonb(?), 0, 0)"
  sqliteOperation.run("first", () => boundary.prepare(sql).run("same", "{}"))
  try {
    sqliteOperation.run("second", () => boundary.prepare(sql).run("same", "{}"))
    expect.unreachable("Unique insert must reject")
  } catch (error) {
    expect(error).toBeInstanceOf(UniqueConstraintError)
    expect((error as UniqueConstraintError).context?.operation).toBe("second")
  }
  expect(records).toHaveLength(1)
})

test("[TASK-252] cache capacity is validated without mutating Bun global cache size", () => {
  const before = Database.MAX_QUERY_CACHE_SIZE
  using db = new Strata({ database: ":memory:" })
  for (const [index, size] of [0, -1, 1.5, Number.NaN].entries()) {
    expect(() =>
      db.collection(`invalid${index}`, schema, {
        statementCacheSize: size,
      } as never)
    ).toThrow(SchemaValidationError)
  }
  expect(Database.MAX_QUERY_CACHE_SIZE).toBe(before)
})

test("[TASK-252] a retained statement wrapper safely prepares again after eviction", () => {
  using db = new Strata({ database: ":memory:" })
  db.collection("items", schema)
  const records = capture(db.sqliteDb)
  const boundary = new SQLiteBoundary(db.sqliteDb, "items", 1)
  const insert = boundary.prepare(
    "INSERT INTO items (_id,body,createdAt,updatedAt) VALUES (?,jsonb(?),0,0)"
  )
  insert.run("a", JSON.stringify({ n: 1, name: "one" }))
  const native = records[0]?.statement
  boundary.prepare("SELECT COUNT(*) AS n FROM items").get()
  expect(native?.isFinalized).toBe(true)
  insert.run("b", JSON.stringify({ n: 2, name: "two" }))
  expect(
    boundary.prepare<{ n: number }, []>("SELECT COUNT(*) AS n FROM items").get()
      ?.n
  ).toBe(2)
})

test("[TASK-252] findOne retains projection/search/cursor option behavior", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", schema)
  await items.insertMany([
    { _id: "a", name: "alpha", n: 1 },
    { _id: "b", name: "beta", n: 2 },
    { _id: "c", name: "gamma", n: 3 },
  ])
  expect(
    await items.findOne({}, { sort: { n: -1 }, select: ["name"] })
  ).toEqual({ _id: "c", name: "gamma" })
  expect(
    (await items.findOne({}, { search: { text: "be", fields: ["name"] } }))?._id
  ).toBe("b")
  expect(
    (await items.findOne({}, { sort: { n: 1 }, cursor: { after: "a" } }))?._id
  ).toBe("b")
})
