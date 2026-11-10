import { QueryError, SchemaValidationError } from "./errors.js"
import type { SQLiteBindValue } from "./query-translator-types.js"

const SEGMENT = /^[A-Za-z_][A-Za-z0-9_]*$/

export function quoteIdent(name: string): string {
  if (typeof name !== "string" || name.length === 0 || name.includes("\0")) {
    throw new SchemaValidationError(
      "Identifiers must be nonempty strings without NUL"
    )
  }
  return `"${name.replaceAll('"', '""')}"`
}

export function fieldPath(name: string): string {
  if (
    typeof name !== "string" ||
    !name.split(".").every((part) => SEGMENT.test(part))
  ) {
    throw new QueryError(`Invalid field path: ${String(name)}`)
  }
  return `$.${name}`
}

export function generatedColumn(name: string): string {
  fieldPath(name)
  // Length-prefix each segment for dotted paths; avoid aliasing a__b with a.b.
  const mapped = name.includes(".")
    ? `_$path_${name
        .split(".")
        .map((part) => `${part.length}_${part}`)
        .join("_")}`
    : `_${name}`
  return quoteIdent(mapped)
}

export function bind(
  value: SQLiteBindValue,
  params: SQLiteBindValue[]
): string {
  params.push(value)
  return `?${params.length}`
}

export function resolveField(
  name: string,
  fields: readonly { readonly name: PropertyKey; readonly indexed?: boolean }[],
  params: SQLiteBindValue[],
  root?: string
): string {
  const path = fieldPath(name)
  if (root !== undefined) {
    return `jsonb_extract(${root}, ${bind(path, params)})`
  }
  if (name === "_id" || name === "createdAt" || name === "updatedAt") {
    return quoteIdent(name)
  }
  if (fields.some((field) => field.name === name && field.indexed)) {
    return generatedColumn(name)
  }
  return `jsonb_extract(body, ${bind(path, params)})`
}

export function resolvePresence(
  name: string,
  params: SQLiteBindValue[],
  root?: string
): string {
  const path = fieldPath(name)
  if (
    root === undefined &&
    (name === "_id" || name === "createdAt" || name === "updatedAt")
  ) {
    return quoteIdent(name)
  }
  // Inspect the original JSON: extraction and generated columns conflate
  // explicit JSON null with missing paths, and extracted text isn't JSON.
  return `json_type(${root ?? "body"}, ${bind(path, params)})`
}

// SQLite forbids parameters in generated-column/index DDL. Only this validated
// path-literal builder may embed a JSON path in DDL.
export function ddlField(name: string): string {
  return `jsonb_extract(body, '${fieldPath(name)}')`
}

export function resolveDDLField(
  name: string,
  fields: readonly { readonly name: PropertyKey; readonly indexed?: boolean }[]
): string {
  fieldPath(name)
  if (name === "_id" || name === "createdAt" || name === "updatedAt") {
    return quoteIdent(name)
  }
  return fields.some((field) => field.name === name && field.indexed)
    ? generatedColumn(name)
    : ddlField(name)
}

export function compoundIndexName(table: string, name: string): string {
  quoteIdent(table)
  quoteIdent(name)
  return quoteIdent(
    `stratadb_ci_${table.length}_${table}_${name.length}_${name}`
  )
}

export function assertNonNegativeInt(
  value: unknown,
  name: string
): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new QueryError(`${name} must be a nonnegative safe integer`)
  }
}

export function arrayElement(
  fieldSql: string,
  index: unknown,
  params: SQLiteBindValue[]
): string {
  assertNonNegativeInt(index, "$index.index")
  return `json_extract(${fieldSql}, ${bind(`$[${index}]`, params)})`
}

// Internal numbered bindings allow a field expression to occur several times
// (ranges, array operators). Expand in SQL order at the public SQL boundary so
// callers can safely concatenate fragments and use ordinary positional binds.
export function positional(
  sql: string,
  params: readonly SQLiteBindValue[]
): {
  sql: string
  params: SQLiteBindValue[]
  indexes: number[]
} {
  const indexes: number[] = []
  const expanded = sql.replace(/\?(\d+)/g, (_, number: string) => {
    indexes.push(Number(number) - 1)
    return "?"
  })
  return {
    sql: expanded,
    params: indexes.map((index) => params[index] as SQLiteBindValue),
    indexes,
  }
}
