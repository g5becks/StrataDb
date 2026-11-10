import type { SQLQueryBindings } from "bun:sqlite"
import {
  bind,
  literalFieldPath,
  positional,
  quoteIdent,
} from "./field-resolver.js"

type Fragment = { sql: string; params: SQLQueryBindings[] }
const isMetadata = (key: string): boolean =>
  key === "_id" || key === "createdAt" || key === "updatedAt"

/** Inclusion uses literal top-level keys, matching the public projection API. */
export function inclusionSQL(
  projection: Readonly<Record<string, 0 | 1 | undefined>> | undefined,
  timestamps: boolean
): Fragment | undefined {
  const entries = Object.entries(projection ?? {})
  if (!entries.some(([, value]) => value === 1)) {
    return
  }
  const selected = entries
    .filter(
      ([key, value]) =>
        value === 1 && key !== "_id" && (timestamps || !isMetadata(key))
    )
    .map(([key]) => key)
  if (projection?._id !== 0) {
    selected.unshift("_id")
  }
  return selected.length <= 50 ? directObject(selected) : largeObject(selected)
}

function directObject(selected: readonly string[]): Fragment {
  const params: SQLQueryBindings[] = []
  const pairs: string[] = []
  const missing: string[] = []
  for (const key of selected) {
    if (isMetadata(key)) {
      pairs.push(`${bind(key, params)}, ${quoteIdent(key)}`)
    } else {
      const path = bind(literalFieldPath(key), params)
      pairs.push(`${bind(key, params)}, body -> ${path}`)
      // An array index on an object is a guaranteed no-op removal path.
      missing.push(
        `CASE WHEN json_type(body, ${path}) IS NULL THEN ${path} ELSE '$[#]' END`
      )
    }
  }
  const object = `json_object(${pairs.join(", ")})`
  return positional(
    missing.length ? `json_remove(${object}, ${missing.join(", ")})` : object,
    params
  )
}

function largeObject(selected: readonly string[]): Fragment {
  // Avoid SQLite's function-argument and compound-SELECT limits for wide selections.
  // Keys are still values, and json_quote makes each a literal JSON-path component.
  const path = "('$.' || json_quote(wanted.value))"
  const encoded = `CASE wanted.value WHEN '_id' THEN json_quote(_id) WHEN 'createdAt' THEN json_quote(createdAt) WHEN 'updatedAt' THEN json_quote(updatedAt) ELSE body -> ${path} END`
  return {
    sql: `(SELECT json_group_object(key, json(encoded)) FROM (SELECT wanted.value AS key, ${encoded} AS encoded FROM json_each(?) AS wanted WHERE wanted.value IN ('_id', 'createdAt', 'updatedAt') OR json_type(body, ${path}) IS NOT NULL ORDER BY wanted.key))`,
    params: [JSON.stringify(selected)],
  }
}
