import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { SchemaValidationError, Strata } from "../../src/index.js"

type Change = {
  operation: string
  table: string
  schema: string
  rowid: number | bigint
}
test("[TASK-256] raw change capture is opt-in and reports raw insert/update/delete", () => {
  const changes: Change[] = []
  using db = new Strata({
    database: ":memory:",
    onRawChange: (event: Change) => {
      changes.push(event)
    },
  })
  db.sqliteDb.run("CREATE TABLE raw_items (name TEXT)")
  db.sqliteDb.run("INSERT INTO raw_items VALUES (?)", ["first"])
  db.sqliteDb.run("UPDATE raw_items SET name = ? WHERE rowid = 1", ["second"])
  db.sqliteDb.run("DELETE FROM raw_items WHERE rowid = 1")
  expect(changes).toEqual([
    { operation: "insert", table: "raw_items", schema: "main", rowid: 1 },
    { operation: "update", table: "raw_items", schema: "main", rowid: 1 },
    { operation: "delete", table: "raw_items", schema: "main", rowid: 1 },
  ])
  using off = new Strata({ database: ":memory:" })
  expect(off.sqliteDb.onInsert).toBeNull()
  expect(off.sqliteDb.onUpdate).toBeNull()
  expect(off.sqliteDb.onDelete).toBeNull()
})

test("[TASK-256] raw capture reports rolled-back rows and unfiltered DELETE is not guaranteed", () => {
  const changes: Change[] = []
  using db = new Strata({
    database: ":memory:",
    onRawChange: (event: Change) => {
      changes.push(event)
    },
  })
  db.sqliteDb.run("CREATE TABLE raw_items (name TEXT)")
  db.sqliteDb.run("BEGIN")
  db.sqliteDb.run("INSERT INTO raw_items VALUES ('rolled back')")
  expect(changes).toHaveLength(1)
  db.sqliteDb.run("ROLLBACK")
  expect(
    db.sqliteDb.query("SELECT count(*) AS n FROM raw_items").get()
  ).toEqual({ n: 0 })
  db.sqliteDb.run("INSERT INTO raw_items VALUES ('persisted')")
  const before = changes.length
  db.sqliteDb.run("DELETE FROM raw_items")
  expect(changes).toHaveLength(before)
})

test("[TASK-256] capture preserves existing caller-owned hooks when disabled and rejects takeover", () => {
  const native = new Database(":memory:")
  const hook = () => {
    /* caller-owned */
  }
  native.onInsert = hook
  using db = new Strata({ database: native })
  expect(db.sqliteDb).toBe(native)
  expect(native.onInsert).toBe(hook)
  expect(
    () =>
      new Strata({
        database: native,
        onRawChange: () => {
          /* observer */
        },
      })
  ).toThrow(SchemaValidationError)
  expect(native.onInsert).toBe(hook)
})

test("[TASK-256] observer failures never escape the SQLite hook", async () => {
  const messages: unknown[][] = []
  const original = console.error
  console.error = (...args: unknown[]) => {
    messages.push(args)
  }
  try {
    for (const asyncFailure of [false, true]) {
      using db = new Strata({
        database: ":memory:",
        onRawChange: () => {
          if (asyncFailure) {
            return Promise.reject(new Error("async observer"))
          }
          throw new Error("sync observer")
        },
      })
      db.sqliteDb.run("CREATE TABLE raw_items (name TEXT)")
      db.sqliteDb.run("INSERT INTO raw_items VALUES ('kept')")
      expect(db.sqliteDb.query("SELECT name FROM raw_items").get()).toEqual({
        name: "kept",
      })
      await Promise.resolve()
    }
    expect(messages).toHaveLength(2)
  } finally {
    console.error = original
  }
})
