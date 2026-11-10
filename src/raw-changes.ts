import type { Database, UpdateHook } from "bun:sqlite"
import { SchemaValidationError } from "./errors.js"

/** Connection-local row notification; it can describe a later rolled-back change. */
export type RawChangeEvent = {
  readonly operation: "insert" | "update" | "delete"
  readonly table: string
  readonly schema: string
  readonly rowid: number | bigint
}
export type RawChangeObserver = (event: RawChangeEvent) => void | Promise<void>

function report(error: unknown): void {
  try {
    console.error("StrataDB raw change observer failed", error)
  } catch {
    // SQLite hook callbacks must never throw, including a custom console sink.
  }
}

/** Claim hooks only on explicit opt-in, refusing to overwrite caller hooks. */
export function captureRawChanges(
  database: Database,
  observer?: RawChangeObserver
): () => void {
  if (!observer) {
    return () => {
      /* no hooks owned */
    }
  }
  if (database.onInsert || database.onUpdate || database.onDelete) {
    throw new SchemaValidationError(
      "Raw change capture requires exclusive ownership of SQLite row hooks"
    )
  }
  const hook =
    (operation: RawChangeEvent["operation"]): UpdateHook =>
    (_database, table, rowid, schema) => {
      try {
        Promise.resolve(observer({ operation, table, rowid, schema })).catch(
          report
        )
      } catch (error) {
        report(error)
      }
    }
  const insert = hook("insert")
  const update = hook("update")
  const remove = hook("delete")
  database.onInsert = insert
  database.onUpdate = update
  database.onDelete = remove
  let released = false
  return () => {
    if (released) {
      return
    }
    released = true
    if (database.onInsert === insert) {
      database.onInsert = null
    }
    if (database.onUpdate === update) {
      database.onUpdate = null
    }
    if (database.onDelete === remove) {
      database.onDelete = null
    }
  }
}
