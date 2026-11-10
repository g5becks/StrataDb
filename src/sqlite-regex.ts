import type { Database } from "bun:sqlite"
import { QueryError } from "./errors.js"

const registered = new WeakSet<Database>()
const patterns = new Map<string, RegExp>()

/** Validate before execution, including queries against empty tables/cache hits. */
export function regexPattern(value: unknown): RegExp {
  if (typeof value !== "string") {
    throw new QueryError("$regex requires a string pattern")
  }
  const existing = patterns.get(value)
  if (existing) {
    patterns.delete(value)
    patterns.set(value, existing)
    return existing
  }
  let pattern: RegExp
  try {
    pattern = new RegExp(value, "u")
  } catch (cause) {
    const error = new QueryError("Invalid $regex pattern")
    Object.defineProperty(error, "cause", { value: cause })
    throw error
  }
  patterns.set(value, pattern)
  if (patterns.size > 64) {
    const oldest = patterns.keys().next().value
    if (oldest !== undefined) {
      patterns.delete(oldest)
    }
  }
  return pattern
}

export function registerRegex(database: Database): void {
  if (registered.has(database)) {
    return
  }
  database.function(
    "strata_regexp",
    { deterministic: true },
    (pattern: unknown, value: unknown) =>
      typeof value === "string" && regexPattern(pattern).test(value) ? 1 : 0
  )
  registered.add(database)
}
