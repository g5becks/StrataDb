import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createSchema, type Document, Strata } from "../../src/index.js"

type Item = Document<{ name?: string | null }>
const pairs = [
  ["émile", ["Émile", "ÉMILE", "émile", "E\u0301mile"]],
  ["αθήνα", ["ΑΘΉΝΑ", "αθήνα"]],
  ["москва", ["МОСКВА", "москва"]],
  ["straße", ["STRAẞE", "straße"]],
  ["istanbul", ["ISTANBUL", "istanbul"]],
  ["i\u0307stanbul", ["İSTANBUL", "i\u0307stanbul"]],
  ["ısparta", ["ısparta"]],
  ["alice", ["ALICE", "Alice", "alice"]],
  ["é%_\\", ["É%_\\"]],
] as const
for (const indexed of [false, true]) {
  for (const cached of [false, true]) {
    test(`[TASK-272] Unicode ilike/search indexed=${indexed} cached=${cached}`, async () => {
      using db = new Strata({ database: ":memory:", enableCache: cached })
      const items = db.collection(
        "items",
        createSchema<Item>().field("name", { type: "TEXT", indexed }).build(),
        { statementCacheSize: cached ? 32 : 1 }
      )
      await items.insertMany(
        pairs.flatMap(([, values]) => values.map((name) => ({ name })))
      )
      await items.insertMany([{ name: null }, {}])
      for (let repeat = 0; repeat < 2; repeat += 1) {
        for (const [query, values] of pairs) {
          const pattern = query.replace(/[\\%_]/gu, (c) => `\\${c}`)
          expect(await items.count({ name: { $ilike: `%${pattern}%` } })).toBe(
            values.length
          )
          expect(
            (await items.search(query, ["name"], { caseSensitive: false }))
              .map((d) => d.name)
              .sort()
          ).toEqual([...values].sort())
          const sensitive = (
            await items.search(query, ["name"], { caseSensitive: true })
          ).map((d) => d.name)
          expect(sensitive.sort()).toEqual(
            values.filter((v) => v.includes(query)).sort()
          )
        }
      }
      expect(await items.count({ name: { $ilike: "%STRASSE%" } })).toBe(0)
    })
  }
}

test("[TASK-272] casefold registers once deterministically, preserves SQL coercion and readonly", async () => {
  const directory = mkdtempSync(join(tmpdir(), "strata-unicode-"))
  const filename = join(directory, "test.db")
  try {
    const native = new Database(filename)
    const register = native.function
    let calls = 0
    Object.defineProperty(native, "function", {
      value(name: string, options: unknown, fn: unknown) {
        if (name === "strata_casefold") {
          calls += 1
          expect(options).toEqual({ deterministic: true })
        }
        return Reflect.apply(register, this, [name, options, fn])
      },
    })
    const schema = createSchema<Item>().build()
    {
      using db = new Strata({ database: native })
      const items = db.collection("items", schema)
      db.collection("other", schema)
      await items.insertOne({ name: "ÉMILE" })
      expect(calls).toBe(1)
      expect(
        native
          .query(
            "SELECT strata_casefold(NULL) AS n, strata_casefold(123) LIKE '12%' AS matched"
          )
          .get()
      ).toEqual({ n: null, matched: 1 })
    }
    using readonly = new Strata({ database: filename, readonly: true })
    const items = readonly.collection("items", schema)
    expect(await items.count({ name: { $ilike: "%émile%" } })).toBe(1)
    expect(await items.search("émile", ["name"])).toHaveLength(1)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
