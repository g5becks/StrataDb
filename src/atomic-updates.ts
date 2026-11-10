import { QueryError, ValidationError } from "./errors.js"
import { bind, fieldPath } from "./field-resolver.js"
import type { SQLiteBindValue } from "./query-translator-types.js"

type Operator = "$set" | "$unset" | "$inc" | "$push" | "$pull"
type Operation = {
  operator: Operator
  path: string
  parts: string[]
  value: unknown
  json: string
}
export type AtomicPlan = readonly Operation[]
const operators = new Set(["$set", "$unset", "$inc", "$push", "$pull"])

function record(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  )
}

function jsonOperand(value: unknown): string {
  if (value === undefined) {
    throw new QueryError("Atomic update values cannot be undefined")
  }
  try {
    const json = JSON.stringify(value, (_key, item: unknown) => {
      if (
        ["function", "symbol", "bigint"].includes(typeof item) ||
        (typeof item === "number" && !Number.isFinite(item))
      ) {
        throw new QueryError("Atomic update requires finite JSON values")
      }
      return item
    })
    // biome-ignore lint/suspicious/noUnnecessaryConditions: JSON.stringify can return undefined despite its library return type
    if (json === undefined) {
      throw new QueryError("Atomic update requires a JSON value")
    }
    return json
  } catch (error) {
    if (error instanceof QueryError) {
      throw error
    }
    const wrapped = new ValidationError(
      "Atomic update value is not serializable JSON",
      undefined,
      value
    )
    Object.defineProperty(wrapped, "cause", {
      value: error,
      configurable: true,
    })
    throw wrapped
  }
}

function operation(operator: string, path: string, value: unknown): Operation {
  fieldPath(path)
  const parts = path.split(".")
  if (["_id", "createdAt", "updatedAt"].includes(parts[0] ?? "")) {
    throw new QueryError("Atomic updates cannot modify document metadata")
  }
  if (
    operator === "$inc" &&
    (typeof value !== "number" || !Number.isFinite(value))
  ) {
    throw new QueryError("$inc requires a finite number")
  }
  if (operator === "$unset" && value !== true && value !== 1 && value !== "") {
    throw new QueryError("$unset requires true, 1 or an empty string")
  }
  const json = jsonOperand(value)
  return {
    operator: operator as Operator,
    path,
    parts,
    value: JSON.parse(json),
    json,
  }
}

/** Validate the whole update even when no row matches. */
export function parseAtomicUpdate(update: unknown): AtomicPlan | null {
  if (!record(update)) {
    throw new QueryError("An update must be a plain object")
  }
  const keys = Object.keys(update)
  if (!keys.some((key) => key.startsWith("$"))) {
    return null
  }
  const plan: Operation[] = []
  for (const [key, values] of Object.entries(update)) {
    if (!operators.has(key)) {
      throw new QueryError(
        "Unknown update operator or mixed operator/plain update"
      )
    }
    if (!record(values)) {
      throw new QueryError(`${key} requires a field/value object`)
    }
    for (const [path, value] of Object.entries(values)) {
      plan.push(operation(key, path, value))
    }
  }
  if (!plan.length) {
    throw new QueryError("Atomic updates require at least one field")
  }
  assertDisjoint(plan)
  return plan
}

function assertDisjoint(plan: AtomicPlan): void {
  const paths = plan.map((item) => item.path).sort()
  for (let index = 1; index < paths.length; index += 1) {
    const previous = paths[index - 1] ?? ""
    const current = paths[index] ?? ""
    if (current === previous || current.startsWith(`${previous}.`)) {
      throw new QueryError("Atomic update paths must not overlap")
    }
  }
}

function increment(current: unknown, amount: unknown): number {
  if (
    current !== undefined &&
    (typeof current !== "number" || !Number.isFinite(current))
  ) {
    throw new QueryError("$inc requires a numeric field")
  }
  const result = Number(current ?? 0) + Number(amount)
  if (!Number.isFinite(result)) {
    throw new QueryError("$inc result must be finite")
  }
  return result
}

function arrayValue(current: unknown): unknown[] {
  if (current === undefined) {
    return []
  }
  if (!Array.isArray(current)) {
    throw new QueryError("Array updates require an array field")
  }
  return current
}

function define(
  target: Record<string, unknown>,
  key: string,
  value: unknown
): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  })
}

function destination(
  root: Record<string, unknown>,
  parts: readonly string[],
  create: boolean
): { target: Record<string, unknown>; key: string } | undefined {
  let target = root
  for (const part of parts.slice(0, -1)) {
    if (!Object.hasOwn(target, part)) {
      if (!create) {
        return
      }
      define(target, part, Object.create(null))
    }
    const child = target[part]
    if (!record(child)) {
      if (!create) {
        return
      }
      throw new QueryError("Cannot traverse a non-object update path")
    }
    target = child
  }
  return { target, key: parts.at(-1) ?? "" }
}

function applyOperation(root: Record<string, unknown>, item: Operation): void {
  const dest = destination(
    root,
    item.parts,
    item.operator !== "$unset" && item.operator !== "$pull"
  )
  if (!dest) {
    return
  }
  const { target, key } = dest
  const current = Object.hasOwn(target, key) ? target[key] : undefined
  switch (item.operator) {
    case "$set":
      define(target, key, JSON.parse(item.json))
      return
    case "$unset":
      delete target[key]
      return
    case "$inc":
      define(target, key, increment(current, item.value))
      return
    case "$push":
      define(target, key, [...arrayValue(current), JSON.parse(item.json)])
      return
    case "$pull":
      if (current === undefined) {
        return
      }
      define(
        target,
        key,
        arrayValue(current).filter(
          (value) => !Bun.deepEquals(value, item.value)
        )
      )
      return
    default:
      throw new QueryError("Unsupported atomic update")
  }
}

export function applyAtomicUpdate<T>(before: T, plan: AtomicPlan): T {
  const result = JSON.parse(JSON.stringify(before)) as Record<string, unknown>
  for (const item of plan) {
    applyOperation(result, item)
  }
  return result as T
}

/** Scalar dotted equality filters seed nested JSON during upsert. */
export function seedEqualities(
  equalities: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [path, value] of Object.entries(equalities)) {
    fieldPath(path)
    const dest = destination(result, path.split("."), true)
    if (dest) {
      define(dest.target, dest.key, value)
    }
  }
  return result
}

function tree(json: string): string {
  return `SELECT fullkey, CASE WHEN type IN ('integer', 'real') THEN 'number' ELSE type END, atom FROM json_tree(${json})`
}

function pullArray(array: string, operand: string): string {
  const value =
    "CASE strata_pull.type WHEN 'object' THEN strata_pull.value WHEN 'array' THEN strata_pull.value WHEN 'true' THEN 'true' WHEN 'false' THEN 'false' ELSE json_quote(strata_pull.value) END"
  const left = tree(value)
  const right = tree(`json(${operand})`)
  return `(SELECT jsonb_group_array(json(${value})) FROM json_each(${array}) AS strata_pull WHERE EXISTS (${left} EXCEPT ${right}) OR EXISTS (${right} EXCEPT ${left}))`
}

/** JSONB expression shared by one-row and whole-batch UPDATE statements. */
export function compileAtomicBody(
  plan: AtomicPlan,
  params: SQLiteBindValue[]
): string {
  let body = "jsonb_remove(body, '$._id', '$.createdAt', '$.updatedAt')"
  for (const item of plan) {
    const path = bind(fieldPath(item.path), params)
    const current = `jsonb_extract(body, ${path})`
    switch (item.operator) {
      case "$set":
        body = `jsonb_set(${body}, ${path}, jsonb(${bind(item.json, params)}))`
        break
      case "$unset":
        body = `jsonb_remove(${body}, ${path})`
        break
      case "$inc":
        body = `jsonb_set(${body}, ${path}, COALESCE(${current}, 0) + ${bind(item.value as number, params)})`
        break
      case "$push":
        body = `jsonb_set(${body}, ${path}, jsonb_insert(COALESCE(${current}, jsonb('[]')), '$[#]', jsonb(${bind(item.json, params)})))`
        break
      case "$pull":
        body = `CASE WHEN json_type(body, ${path}) IS NULL THEN ${body} ELSE jsonb_set(${body}, ${path}, ${pullArray(current, bind(item.json, params))}) END`
        break
      default:
        throw new QueryError("Unsupported atomic update")
    }
  }
  return body
}
