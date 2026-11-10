import type { Database } from "bun:sqlite"
import { ConnectionError, DatabaseError } from "./errors.js"

// Share lifecycle state across cached collections and fluent builder collections.
const closedDatabases = new WeakSet<Database>()
const readonlyDatabases = new WeakSet<Database>()
const writes = new Set([
  "insertOne",
  "insertMany",
  "updateOne",
  "replaceOne",
  "deleteOne",
  "updateMany",
  "deleteMany",
  "findOneAndDelete",
  "findOneAndUpdate",
  "findOneAndReplace",
  "drop",
])

export function markDatabaseReadonly(database: Database): void {
  readonlyDatabases.add(database)
}

export function isDatabaseReadonly(database: Database): boolean {
  return readonlyDatabases.has(database)
}

export function assertOperationAllowed(
  database: Database,
  operation: string
): void {
  if (isDatabaseReadonly(database) && writes.has(operation)) {
    throw new DatabaseError("StrataDB database is read-only", 8)
  }
}

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
