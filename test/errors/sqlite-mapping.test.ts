import { SQLiteError } from "bun:sqlite"
import { expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ConstraintError, DatabaseError } from "../../src/errors.js"
import {
  ConnectionError,
  createSchema,
  type Document,
  QueryError,
  Strata,
  UniqueConstraintError,
} from "../../src/index.js"

type Item = Document<{ name: string }>

for (const failure of [
  "missing table",
  "syntax",
  "constraint",
  "unique",
] as const) {
  test(`A19 [TASK-234] public operation maps ${failure} with diagnostic context`, async () => {
    using db = new Strata({ database: ":memory:" })
    const items = db.collection(
      "items",
      createSchema<Item>()
        .field("name", { type: "TEXT", indexed: true, unique: true })
        .build()
    )
    await items.insertOne({ name: "kept" })
    if (failure === "missing table") {
      db.sqliteDb.exec('DROP TABLE "items"')
    }
    if (failure === "syntax") {
      db.sqliteDb.exec(
        "CREATE TRIGGER broken BEFORE INSERT ON items BEGIN SELECT missing_function(); END"
      )
    }
    if (failure === "constraint") {
      db.sqliteDb.exec(
        "CREATE TRIGGER rejected BEFORE INSERT ON items BEGIN SELECT RAISE(ABORT, 'rejected'); END"
      )
    }
    const error = await items
      .insertOne({ name: "kept" })
      .catch((caught: unknown) => caught)
    expect(error).not.toBeInstanceOf(SQLiteError)
    expect(error).toBeInstanceOf(
      {
        "missing table": QueryError,
        syntax: QueryError,
        constraint: ConstraintError,
        unique: UniqueConstraintError,
      }[failure]
    )
    expect(error).toMatchObject({
      errno: expect.any(Number),
      context: {
        collection: "items",
        operation: "insertOne",
        sql: expect.any(String),
      },
      cause: expect.any(SQLiteError),
    })
  })
}

test("A19 [TASK-234] database open and corrupt-file errors are typed", () => {
  const directory = mkdtempSync(join(tmpdir(), "stratadb-errors-"))
  try {
    expect(
      () => new Strata({ database: join(directory, "missing", "db.sqlite") })
    ).toThrow(ConnectionError)
    const corrupt = join(directory, "corrupt.sqlite")
    writeFileSync(corrupt, "This is not a SQLite database".repeat(100))
    let failure: unknown
    try {
      using db = new Strata({ database: corrupt })
      db.collection("items", createSchema<Item>().build())
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(DatabaseError)
    expect(failure).toHaveProperty("cause")
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
