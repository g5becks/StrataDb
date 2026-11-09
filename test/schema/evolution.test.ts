import { expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { compoundIndexName } from "../../src/field-resolver.js"
import {
  ConnectionError,
  createSchema,
  type Document,
  SchemaValidationError,
  Strata,
  UniqueConstraintError,
} from "../../src/index.js"

type Item = Document<{ name: string; age: number; profile: { city: string } }>

async function fixture(
  run: (filename: string) => Promise<void> | void
): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), "stratadb-schema-"))
  try {
    await run(join(directory, "test.db"))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test("A10 [TASK-243] reopening adds generated columns and indexes for existing rows", async () => {
  await fixture(async (filename) => {
    {
      using db = new Strata({ database: filename })
      await db
        .collection("order-items", createSchema<Item>().build())
        .insertOne({
          name: "retained",
          age: 42,
          profile: { city: "Oslo" },
        })
    }
    using db = new Strata({ database: filename })
    const items = db.collection(
      "order-items",
      createSchema<Item>()
        .field("age", { type: "INTEGER", indexed: true })
        .field("profile.city", { type: "TEXT", indexed: true })
        .build()
    )
    expect(
      await items.findOne({ age: 42, "profile.city": "Oslo" })
    ).toMatchObject({ name: "retained" })
    const columns = db.sqliteDb
      .query<{ name: string; hidden: number }, []>(
        'PRAGMA table_xinfo("order-items")'
      )
      .all()
    expect(
      columns
        .filter((column) => column.hidden === 2)
        .map((column) => column.name)
        .sort()
    ).toEqual(["_$path_7_profile_4_city", "_age"])
    const indexes = db.sqliteDb
      .query<{ name: string }, []>('PRAGMA index_list("order-items")')
      .all()
    expect(indexes.map((index) => index.name)).toContain("idx_order-items_age")
    expect(indexes.map((index) => index.name)).toContain(
      "idx_order-items_profile.city"
    )
    expect(
      db.sqliteDb
        .query<{ detail: string }, []>(
          'EXPLAIN QUERY PLAN SELECT * FROM "order-items" WHERE _age = 42'
        )
        .all()
        .some((row) => row.detail.includes("idx_order-items_age"))
    ).toBe(true)
  })
})

test("[TASK-243] removed and changed generated columns report drift", async () => {
  await fixture((filename) => {
    {
      using db = new Strata({ database: filename })
      db.collection(
        "items",
        createSchema<Item>()
          .field("name", { type: "TEXT", indexed: true })
          .field("age", { type: "INTEGER", indexed: true })
          .build()
      )
    }
    const changes: unknown[] = []
    using db = new Strata({
      database: filename,
      onSchemaDrift: (change: unknown) => changes.push(change),
    })
    db.collection(
      "items",
      createSchema<Item>().field("age", { type: "REAL", indexed: true }).build()
    )
    expect(changes).toEqual([
      {
        collection: "items",
        column: "_name",
        kind: "removed",
        storedType: "TEXT",
      },
      {
        collection: "items",
        column: "_age",
        kind: "type-changed",
        storedType: "INTEGER",
        expectedType: "REAL",
      },
    ])
  })
})

test("[TASK-243] strict drift rejects before altering the table", async () => {
  await fixture((filename) => {
    {
      using db = new Strata({ database: filename })
      db.collection(
        "items",
        createSchema<Item>()
          .field("age", { type: "INTEGER", indexed: true })
          .build()
      )
    }
    using db = new Strata({ database: filename, onSchemaDrift: "error" })
    expect(() =>
      db.collection(
        "items",
        createSchema<Item>()
          .field("name", { type: "TEXT", indexed: true })
          .build()
      )
    ).toThrow(SchemaValidationError)
    expect(
      db.sqliteDb
        .query<{ name: string }, []>('PRAGMA table_xinfo("items")')
        .all()
        .map((column) => column.name)
    ).not.toContain("_name")
  })
})

test("[TASK-243] failed unique index creation rolls back added columns", async () => {
  await fixture(async (filename) => {
    {
      using db = new Strata({ database: filename })
      await db.collection("items", createSchema<Item>().build()).insertMany([
        { name: "duplicate", age: 1, profile: { city: "A" } },
        { name: "duplicate", age: 2, profile: { city: "B" } },
      ])
    }
    using db = new Strata({ database: filename })
    expect(() =>
      db.collection(
        "items",
        createSchema<Item>()
          .field("name", { type: "TEXT", indexed: true, unique: true })
          .build()
      )
    ).toThrow(UniqueConstraintError)
    expect(
      db.sqliteDb
        .query<{ name: string }, []>('PRAGMA table_xinfo("items")')
        .all()
        .map((column) => column.name)
    ).not.toContain("_name")
    expect(
      await db.collection("items", createSchema<Item>().build()).count({})
    ).toBe(2)
  })
})

test("[TASK-243] migration repairs indexes previously created on missing quoted columns", async () => {
  await fixture(async (filename) => {
    {
      using db = new Strata({ database: filename })
      await db.collection("items", createSchema<Item>().build()).insertMany([
        { name: "a", age: 1, profile: { city: "A" } },
        { name: "b", age: 2, profile: { city: "B" } },
      ])
      // Reproduce the pre-evolution CREATE INDEX behavior on SQLite DQS.
      db.sqliteDb.run('CREATE INDEX idx_items_age ON items("_age")')
      db.sqliteDb.run(
        `CREATE INDEX ${compoundIndexName("items", "age-name")} ON items("_age", jsonb_extract(body, '$.name'))`
      )
    }
    using db = new Strata({ database: filename })
    const items = db.collection(
      "items",
      createSchema<Item>()
        .field("age", { type: "INTEGER", indexed: true })
        .compoundIndex("age-name", ["age", "name"])
        .build()
    )
    expect((await items.find({ age: 2 })).map((item) => item.name)).toEqual([
      "b",
    ])
    expect(
      db.sqliteDb
        .query<{ integrity_check: string }, []>("PRAGMA integrity_check")
        .all()
    ).toEqual([{ integrity_check: "ok" }])
  })
})

test("[TASK-243] a locked DDL transaction preserves typed SQLite errors", async () => {
  await fixture((filename) => {
    using first = new Strata({ database: filename })
    first.collection("items", createSchema<Item>().build())
    using second = new Strata({ database: filename })
    first.sqliteDb.exec("BEGIN IMMEDIATE")
    try {
      expect(() =>
        second.collection(
          "items",
          createSchema<Item>()
            .field("age", { type: "INTEGER", indexed: true })
            .build()
        )
      ).toThrow(ConnectionError)
    } finally {
      first.sqliteDb.exec("ROLLBACK")
    }
  })
})
