import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { InvalidQueryOperatorError } from "../../src/errors.js"
import {
  createSchema,
  type Document,
  QueryError,
  Strata,
  UniqueConstraintError,
} from "../../src/index.js"

type User = Document<{
  name: string
  role: string
  nick?: string | null
  items?: { sku: string; qty: number }[]
  a?: number
  b?: number
}>

const schema = () =>
  createSchema<User>()
    .field("name", { type: "TEXT", indexed: true, unique: true })
    .field("role", { type: "TEXT" })
    .build()

let db: Strata
let users: ReturnType<Strata["collection"]>

beforeEach(async () => {
  db = new Strata({ database: ":memory:" })
  users = db.collection("users", schema())
  await users.insertMany([
    { name: "alice", role: "admin", nick: null, items: [{ sku: "X", qty: 5 }] },
    { name: "bob", role: "user", nick: "B" },
    { name: "carol", role: "user" },
    { name: "50% off", role: "promo" },
  ])
})

afterEach(() => db.close())

test("A1 [TASK-228] filter-key injection rejects without exposing rows", async () => {
  await expect(
    Promise.resolve().then(() =>
      users.find({ "x') IS NULL OR 1=1 OR jsonb_extract(body,'$.x": "zzz" })
    )
  ).rejects.toBeInstanceOf(QueryError)
  expect(await users.count({})).toBe(4)
})

test("A1 [TASK-228] $index injection rejects", async () => {
  await expect(
    Promise.resolve().then(() =>
      users.find({
        items: {
          $index: {
            index: "0]') OR 1=1 OR json_extract('[1]','$[0",
            condition: "zzz",
          },
        },
      } as never)
    )
  ).rejects.toBeInstanceOf(QueryError)
  expect(await users.count({})).toBe(4)
})

test("A1 [TASK-228] limit injection rejects before SQL parsing", async () => {
  await expect(
    Promise.resolve().then(() =>
      users.find({}, { limit: "0 UNION SELECT 1" } as never)
    )
  ).rejects.toBeInstanceOf(QueryError)
  expect(await users.count({})).toBe(4)
})

test("A2 [TASK-229] unknown operator cannot delete documents", async () => {
  await expect(
    Promise.resolve().then(() =>
      users.deleteMany({ role: { $eqq: "admin" } } as never)
    )
  ).rejects.toBeInstanceOf(InvalidQueryOperatorError)
  expect(await users.count({})).toBe(4)
})

test("A3 [TASK-231] concurrent conditional updateOne has one winner", async () => {
  const results = await Promise.all([
    users.updateOne({ name: "alice", role: "admin" }, { role: "running" }),
    users.updateOne({ name: "alice", role: "admin" }, { role: "running" }),
  ])
  expect(results.filter(Boolean)).toHaveLength(1)
})

test("A3 [TASK-231] concurrent updateOne preserves both fields", async () => {
  await Promise.all([
    users.updateOne({ name: "alice" }, { a: 1 }),
    users.updateOne({ name: "alice" }, { b: 2 }),
  ])
  expect(await users.findOne({ name: "alice" })).toMatchObject({ a: 1, b: 2 })
})

test("A4 [TASK-232] deleteMany nests inside execute", async () => {
  const result = await db.execute(() => users.deleteMany({ role: "user" }))
  expect(result.deletedCount).toBe(2)
  expect(await users.count({})).toBe(2)
})

test("A4 [TASK-232] updateMany nests inside execute", async () => {
  const result = await db.execute(() =>
    users.updateMany({ role: "user" }, { role: "changed" })
  )
  expect(result.modifiedCount).toBe(2)
  expect(await users.count({ role: "changed" })).toBe(2)
})

test("A4 [TASK-232] outside write survives execute rollback", async () => {
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const transaction = db.execute(async () => {
    entered.resolve()
    await release.promise
    throw new Error("rollback marker")
  })
  const rolledBack = transaction.catch((error: unknown) => error)
  await entered.promise
  const outside = users.insertOne({ name: "outside", role: "user" })
  release.resolve()
  expect(await rolledBack).toEqual(new Error("rollback marker"))
  await outside
  expect(await users.findOne({ name: "outside" })).not.toBeNull()
})

test("A4 [TASK-232] rolled back writes emit no insert events", async () => {
  let events = 0
  users.on("insert", () => {
    events += 1
  })
  await expect(
    db.execute(async () => {
      await users.insertOne({ name: "rollback", role: "user" })
      throw new Error("rollback marker")
    })
  ).rejects.toThrow("rollback marker")
  expect(await users.findOne({ name: "rollback" })).toBeNull()
  expect(events).toBe(0)
})

test("A5 [TASK-230] insertOne returns a rejected promise on invalid insert", async () => {
  let result: Promise<unknown> | undefined
  let synchronousError: unknown
  try {
    result = users.insertOne({ name: "alice", role: "duplicate" })
    result.catch(() => {
      /* Rejection is asserted below. */
    })
  } catch (error) {
    synchronousError = error
  }
  expect(synchronousError).toBeUndefined()
  expect(result).toBeInstanceOf(Promise)
  await expect(result).rejects.toBeInstanceOf(UniqueConstraintError)
})

test("A6 [TASK-233] throwing listener does not fail committed insert", async () => {
  users.on("insert", () => {
    throw new Error("listener boom")
  })
  const inserted = await users.insertOne({ name: "listener", role: "user" })
  expect(await users.findById(inserted._id)).toMatchObject({ name: "listener" })
})

const compoundSchema = () =>
  createSchema<User>()
    .field("name", { type: "TEXT", indexed: true })
    .compoundIndex("name_role", ["name", "role"], { unique: true })
    .build()

test("A8 [TASK-235] compound index exists in SQLite", () => {
  db.collection("compound", compoundSchema())
  const indexes = db.sqliteDb
    .query<{ name: string }, []>("PRAGMA index_list('compound')")
    .all()
  expect(indexes.some((index) => index.name.includes("name_role"))).toBe(true)
})

test("A8 [TASK-235] unique compound index rejects duplicate tuple", async () => {
  const collection = db.collection("compound", compoundSchema())
  await collection.insertOne({ name: "same", role: "same" })
  await expect(
    Promise.resolve().then(() =>
      collection.insertOne({ name: "same", role: "same" })
    )
  ).rejects.toBeInstanceOf(UniqueConstraintError)
  expect(await collection.count({})).toBe(1)
})

test("A9 [TASK-236] timestamps(false) omits timestamp fields", async () => {
  const collection = db.collection(
    "no_timestamps",
    createSchema<User>().timestamps(false).build()
  )
  const inserted = await collection.insertOne({ name: "plain", role: "user" })
  expect(inserted).not.toHaveProperty("createdAt")
  expect(inserted).not.toHaveProperty("updatedAt")
})

test("A10 [TASK-243] reopened collection adds indexed field", async () => {
  const directory = mkdtempSync(join(tmpdir(), "stratadb-evolution-"))
  const filename = join(directory, "evolution.db")
  try {
    {
      using first = new Strata({ database: filename })
      await first
        .collection("evolution", createSchema<User>().build())
        .insertOne({ name: "retained", role: "user" })
    }
    using reopened = new Strata({ database: filename })
    const collection = reopened.collection("evolution", schema())
    expect(await collection.findOne({ name: "retained" })).toMatchObject({
      name: "retained",
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("A11 [TASK-237] null equality includes null and missing", async () => {
  const matches = await users.find({ nick: null })
  expect(matches.map((document) => document.name).sort()).toEqual([
    "50% off",
    "alice",
    "carol",
  ])
})

test("A11 [TASK-237] $ne null matches present non-null values", async () => {
  expect(
    (await users.find({ nick: { $ne: null } })).map((doc) => doc.name)
  ).toEqual(["bob"])
})

test("A11 [TASK-237] $ne includes missing and null for non-null operand", async () => {
  expect(await users.count({ nick: { $ne: "B" } })).toBe(3)
})

test.failing("A12 [TASK-245] $elemMatch resolves object fields", async () => {
  expect(
    await users.find({ items: { $elemMatch: { sku: "X" } } } as never)
  ).toMatchObject([{ name: "alice" }])
})

test.failing("A12 [TASK-245] $elemMatch resolves nested operators", async () => {
  expect(
    await users.find({ items: { $elemMatch: { qty: { $gte: 2 } } } } as never)
  ).toMatchObject([{ name: "alice" }])
})

test("A13 [TASK-238] $like is case sensitive", async () => {
  expect(await users.find({ name: { $like: "ALICE" } })).toEqual([])
})

test("A13 [TASK-238] startsWith treats underscore literally", async () => {
  expect(await users.find({ name: { $startsWith: "_" } })).toEqual([])
})

test("A13 [TASK-238] search honors caseSensitive", async () => {
  expect(
    await users.find(
      {},
      {
        search: { fields: ["name"], text: "ALICE", caseSensitive: true },
      }
    )
  ).toEqual([])
})

test("A14 [TASK-239] skip without limit returns remaining rows", async () => {
  expect(
    (await users.find({}, { sort: { name: 1 }, skip: 1 })).map(
      (doc) => doc.name
    )
  ).toEqual(["alice", "bob", "carol"])
})

test.failing("A15 [TASK-246] unknown cursor raises QueryError", async () => {
  await expect(
    Promise.resolve().then(() =>
      users.find(
        {},
        {
          sort: { name: 1 },
          cursor: { after: "unknown" },
        }
      )
    )
  ).rejects.toBeInstanceOf(QueryError)
  expect(await users.count({})).toBe(4)
})

for (const name of ["order", "user-data"]) {
  test(`A16 [TASK-228] quoted collection name ${name} supports CRUD`, async () => {
    const collection = db.collection(name, schema())
    const inserted = await collection.insertOne({ name: "legal", role: "user" })
    expect(await collection.findById(inserted._id)).toMatchObject({
      name: "legal",
    })
  })
}

test("A17 [TASK-244] delete event carries resolved id", async () => {
  const document = await users.findOne({ name: "alice" })
  const events: unknown[] = []
  users.on("delete", (event) => events.push(event))
  await users.deleteOne({ name: "alice" })
  expect(events).toMatchObject([{ _id: document?._id, deleted: true }])
})

test("A17 [TASK-244] deleteMany event carries exact ids", async () => {
  const documents = await users.find({ role: "user" })
  const events: unknown[] = []
  users.on("deleteMany", (event) => events.push(event))
  await users.deleteMany({ role: "user" })
  expect(events).toMatchObject([
    { ids: documents.map((document) => document._id), deletedCount: 2 },
  ])
})
