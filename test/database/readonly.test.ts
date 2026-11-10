import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  ConnectionError,
  createSchema,
  DatabaseError,
  type Document,
  SchemaValidationError,
  Strata,
} from "../../src/index.js"

type Item = Document<{ name: string; count: number; rank?: number }>
const DDL = /^\s*(?:CREATE|ALTER|DROP)\b/iu
const schema = createSchema<Item>()
  .field("count", { type: "INTEGER", indexed: true })
  .build()
async function fixture(
  run: (filename: string) => Promise<void> | void
): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), "stratadb-readonly-"))
  const filename = join(directory, "test.db")
  try {
    {
      using db = new Strata({ database: filename })
      await db
        .collection("items", schema)
        .insertOne({ _id: "a", name: "a", count: 1 })
    }
    await run(filename)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test("[TASK-250] read-only collections and transactions execute reads without DDL", async () => {
  await fixture(async (filename) => {
    const before = readFileSync(filename)
    using db = new Strata({ database: filename, readonly: true })
    const statements: string[] = []
    for (const method of ["run", "exec", "prepare"] as const) {
      const native = db.sqliteDb[method]
      Object.defineProperty(db.sqliteDb, method, {
        value(...args: unknown[]) {
          statements.push(String(args[0]))
          return Reflect.apply(native, this, args)
        },
      })
    }
    const items = db.collection("items", schema)
    expect(await items.findOne({ count: 1 })).toMatchObject({
      _id: "a",
      name: "a",
    })
    expect(await items.count({})).toBe(1)
    expect(await items.distinct("name")).toEqual(["a"])
    expect(
      await db.execute((transaction) =>
        transaction.collection("items", schema).findById("a")
      )
    ).toMatchObject({ count: 1 })
    using tx = db.transaction()
    expect(await tx.collection("items", schema).count({})).toBe(1)
    tx.commit()
    expect(statements.filter((sql) => DDL.test(sql))).toEqual([])
    expect(() =>
      db.sqliteDb.exec("UPDATE items SET updatedAt=updatedAt")
    ).toThrow()
    expect(readFileSync(filename)).toEqual(before)
  })
})

test("[TASK-250] every write rejects once without changing rows or emitting events", async () => {
  await fixture(async (filename) => {
    const before = readFileSync(filename)
    let attempts = 0
    using db = new Strata({
      database: filename,
      readonly: true,
      retry: {
        retries: 2,
        minTimeout: 1,
        onFailedAttempt: () => {
          attempts += 1
        },
      },
    })
    const items = db.collection("items", schema)
    let events = 0
    items
      .on("insert", () => {
        events += 1
      })
      .on("update", () => {
        events += 1
      })
      .on("delete", () => {
        events += 1
      })
      .on("drop", () => {
        events += 1
      })
    const data = { name: "changed", count: 2 }
    const operations = [
      () => items.insertOne(data),
      () => items.insertMany([data]),
      () => items.updateOne("a", data),
      () => items.replaceOne("a", data),
      () => items.deleteOne("a"),
      () => items.updateMany({}, data),
      () => items.deleteMany({}),
      () => items.findOneAndDelete("a"),
      () => items.findOneAndUpdate("a", data),
      () => items.findOneAndReplace("a", data),
      () => items.drop(),
    ]
    for (const operation of operations) {
      let result: unknown
      expect(() => {
        result = operation()
      }).not.toThrow()
      expect(result).toBeInstanceOf(Promise)
      await expect(result).rejects.toBeInstanceOf(DatabaseError)
      await expect(result).rejects.toThrow("read-only")
    }
    expect(attempts).toBe(operations.length)
    expect(events).toBe(0)
    expect(await items.findOne("a")).toMatchObject({ name: "a", count: 1 })
    expect(readFileSync(filename)).toEqual(before)
  })
})

test("[TASK-250] read-only open never creates a missing database file", () => {
  const directory = mkdtempSync(join(tmpdir(), "stratadb-readonly-missing-"))
  const filename = join(directory, "absent.db")
  try {
    expect(() => {
      const db = new Strata({ database: filename, readonly: true })
      db.close()
    }).toThrow(ConnectionError)
    expect(existsSync(filename)).toBe(false)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("[TASK-250] unavailable read-only tables and indexed columns reject without migration", async () => {
  await fixture((filename) => {
    using db = new Strata({ database: filename, readonly: true })
    expect(() =>
      db.collection(
        "items",
        createSchema<Item>()
          .field("rank", { type: "INTEGER", indexed: true })
          .build()
      )
    ).toThrow(SchemaValidationError)
    expect(() => db.collection("missing", schema)).toThrow(
      SchemaValidationError
    )
  })
})

test("[TASK-250] supplied read-only connections and fluent collections share policy", async () => {
  await fixture(async (filename) => {
    using connection = new Database(filename, { readonly: true })
    using db = new Strata({ database: connection, readonly: true })
    const items = db
      .collection<Item>("items")
      .field("count", { type: "INTEGER", indexed: true })
      .build()
    expect(await items.count({ count: 1 })).toBe(1)
    await expect(
      items.updateOne("a", { $inc: { count: 1 } })
    ).rejects.toBeInstanceOf(DatabaseError)
  })
})

test("[TASK-250] read-only schema drift reports or rejects without DDL", async () => {
  await fixture(async (filename) => {
    const changed = createSchema<Item>()
      .field("count", { type: "REAL", indexed: true })
      .build()
    const drift: unknown[] = []
    {
      using db = new Strata({
        database: filename,
        readonly: true,
        onSchemaDrift: (change) => drift.push(change),
      })
      expect(await db.collection("items", changed).count({})).toBe(1)
    }
    expect(drift).toEqual([
      {
        collection: "items",
        column: "_count",
        kind: "type-changed",
        storedType: "INTEGER",
        expectedType: "REAL",
      },
    ])
    using db = new Strata({
      database: filename,
      readonly: true,
      onSchemaDrift: "error",
    })
    expect(() => db.collection("items", changed)).toThrow(SchemaValidationError)
  })
})
