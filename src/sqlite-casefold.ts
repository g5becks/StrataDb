import type { Database } from "bun:sqlite"

const registered = new WeakSet<Database>()

/** Locale-independent Unicode lowercase after canonical NFC normalization. */
export function registerCasefold(database: Database): void {
  if (registered.has(database)) {
    return
  }
  database.function("strata_casefold", { deterministic: true }, (value) =>
    typeof value === "string" ? value.normalize("NFC").toLowerCase() : value
  )
  registered.add(database)
}
