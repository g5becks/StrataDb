import type { SQLQueryBindings } from "bun:sqlite"
import type { Document } from "./core-types.js"
import { QueryError } from "./errors.js"
import { bind, positional, quoteIdent, resolveField } from "./field-resolver.js"
import type { CursorSpec, SortSpec } from "./query-options-types.js"
import type { SchemaDefinition } from "./schema-types.js"
import type { SQLiteBoundary } from "./sqlite-boundary.js"

export function cursorOrder<T extends Document>(
  sort: SortSpec<T> | undefined,
  cursor: CursorSpec | undefined
): { sort: SortSpec<T> | undefined; reverse: boolean } {
  const entries = Object.entries(sort ?? {})
  if (cursor !== undefined) {
    if (
      !cursor ||
      typeof cursor !== "object" ||
      Array.isArray(cursor) ||
      entries.length === 0
    ) {
      throw new QueryError(
        "Cursor pagination requires a nonempty sort and cursor"
      )
    }
    const id = cursor.after ?? cursor.before
    if (
      (cursor.after !== undefined) === (cursor.before !== undefined) ||
      typeof id !== "string" ||
      id.length === 0 ||
      Object.keys(cursor).some((key) => key !== "after" && key !== "before")
    ) {
      throw new QueryError(
        "Cursor requires exactly one nonempty after or before ID"
      )
    }
  }
  if (entries.length && !entries.some(([field]) => field === "_id")) {
    entries.push(["_id", 1])
  }
  return {
    sort: entries.length ? (Object.fromEntries(entries) as SortSpec<T>) : sort,
    reverse: cursor?.before !== undefined,
  }
}

export function reverseSort<T>(sort: SortSpec<T>): SortSpec<T> {
  return Object.fromEntries(
    Object.entries(sort).map(([field, direction]) => [
      field,
      direction === 1 ? -1 : 1,
    ])
  ) as SortSpec<T>
}

function comparison(
  column: string,
  value: SQLQueryBindings,
  greater: boolean,
  params: SQLQueryBindings[]
): string {
  if (value === null) {
    return greater ? `${column} IS NOT NULL` : "0=1"
  }
  const operand = bind(value, params)
  return greater
    ? `${column} > ${operand}`
    : `(${column} IS NULL OR ${column} < ${operand})`
}

export function buildCursorPredicate<T extends Document>(context: {
  sql: SQLiteBoundary
  collection: string
  schema: SchemaDefinition<T>
  cursor: CursorSpec
  sort: SortSpec<T>
}): { sql: string; params: SQLQueryBindings[] } {
  const { sql, collection, schema, cursor, sort } = context
  const entries = Object.entries(sort)
  const lookupParams: SQLQueryBindings[] = []
  const selection = entries.map(
    ([field], index) =>
      `${resolveField(field, schema.fields, lookupParams)} AS k${index}`
  )
  const lookup = positional(
    `SELECT ${selection.join(", ")} FROM ${quoteIdent(collection)} WHERE _id = ${bind(cursor.after ?? cursor.before ?? "", lookupParams)}`,
    lookupParams
  )
  const row = sql
    .prepare<Record<string, SQLQueryBindings>, SQLQueryBindings[]>(lookup.sql)
    .get(...lookup.params)
  if (!row) {
    throw new QueryError("Cursor document was not found")
  }
  const params: SQLQueryBindings[] = []
  const equals: string[] = []
  const branches = entries.map(([field, direction], index) => {
    if (direction !== 1 && direction !== -1) {
      throw new QueryError("Sort direction must be 1 or -1")
    }
    const column = resolveField(field, schema.fields, params)
    const value = row[`k${index}`] ?? null
    const part = comparison(
      column,
      value,
      (cursor.after !== undefined) === (direction === 1),
      params
    )
    const branch = `(${[...equals, part].join(" AND ")})`
    equals.push(`${column} IS ${bind(value, params)}`)
    return branch
  })
  return positional(`(${branches.join(" OR ")})`, params)
}
