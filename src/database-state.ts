import type { Database } from "bun:sqlite"
import { ConnectionError } from "./errors.js"

// Share lifecycle state across cached collections and fluent builder collections.
const closedDatabases = new WeakSet<Database>()

export function isDatabaseClosed(database: Database): boolean {
  return closedDatabases.has(database)
}

export function markDatabaseClosed(database: Database): void {
  closedDatabases.add(database)
}

export function assertDatabaseOpen(database: Database): void {
  if (isDatabaseClosed(database)) {
    throw new ConnectionError("StrataDB database is closed")
  }
}
