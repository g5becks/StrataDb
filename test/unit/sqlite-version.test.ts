import { Database } from "bun:sqlite"
import { expect, spyOn, test } from "bun:test"
import { ConnectionError, Strata } from "../../src/index.js"

test.each([
  "3.9.0",
  "3.44.9",
  "2.99.99",
])("rejects SQLite %s with an actionable connection error", (version) => {
  using sqlite = new Database(":memory:")
  const query = spyOn(sqlite, "query").mockReturnValue({
    get: () => ({ version }),
  } as ReturnType<Database["query"]>)
  try {
    expect(() => new Strata({ database: sqlite })).toThrow(ConnectionError)
    expect(() => new Strata({ database: sqlite })).toThrow(version)
    expect(() => new Strata({ database: sqlite })).toThrow("3.45.0")
    expect(() => new Strata({ database: sqlite })).toThrow(
      "Database.setCustomSQLite()"
    )
  } finally {
    query.mockRestore()
  }
  // Rejecting an externally supplied connection does not take ownership of it.
  expect(sqlite.query("SELECT 1 AS value").get()).toEqual({ value: 1 })
})

test.each([
  "3.45.0",
  "3.100.0",
  "4.0.0",
])("accepts SQLite %s and checks the version once", (version) => {
  using sqlite = new Database(":memory:")
  const query = spyOn(sqlite, "query").mockReturnValue({
    get: () => ({ version }),
  } as ReturnType<Database["query"]>)
  let db: Strata | undefined
  try {
    db = new Strata({ database: sqlite })
    expect(query).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledWith("SELECT sqlite_version() AS version")
  } finally {
    query.mockRestore()
    db?.close()
  }
})
