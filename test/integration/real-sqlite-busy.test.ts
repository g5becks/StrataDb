import { Database, SQLiteError } from "bun:sqlite"
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createSchema, type Document, Strata } from "../../src/index.js"
import { defaultShouldRetry } from "../../src/retry-utils.js"

test("A7: real SQLITE_BUSY retries after another connection releases its lock", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stratadb-busy-"))
  let release: ReturnType<typeof setTimeout> | undefined
  try {
    using owner = new Database(join(directory, "busy.db"))
    using db = new Strata({ database: join(directory, "busy.db") })
    const collection = db.collection(
      "users",
      createSchema<Document<{ name: string }>>()
        .field("name", { type: "TEXT" })
        .build()
    )
    db.sqliteDb.exec("PRAGMA busy_timeout=0")
    owner.exec("BEGIN IMMEDIATE")
    try {
      // retry:false still has the pre-0.6 synchronous error contract.
      await collection.insertOne({ name: "disabled" }, { retry: false })
      expect.unreachable("Expected SQLITE_BUSY with retries disabled")
    } catch (error) {
      expect(error).toBeInstanceOf(SQLiteError)
      expect((error as SQLiteError).errno % 256).toBe(5)
    }
    const failures: number[] = []
    release = setTimeout(() => owner.exec("COMMIT"), 20)
    const inserted = await collection.insertOne(
      { name: "retried" },
      {
        retry: {
          retries: 10,
          minTimeout: 5,
          maxTimeout: 5,
          shouldRetry: defaultShouldRetry,
          onFailedAttempt: ({ error }) => {
            expect(error).toBeInstanceOf(SQLiteError)
            failures.push((error as SQLiteError).errno)
          },
        },
      }
    )
    expect(inserted.name).toBe("retried")
    expect(failures.length).toBeGreaterThan(0)
    expect(failures.every((errno) => errno % 256 === 5)).toBe(true)
    expect(await collection.count({})).toBe(1)
  } finally {
    clearTimeout(release)
    await rm(directory, { recursive: true, force: true })
  }
})
