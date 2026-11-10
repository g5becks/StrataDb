export type Filter = Record<string, unknown>
const SPECIAL = /[.*+?^${}()|[\]\\]/gu
const ASCII_UPPER = /[A-Z]/gu
const logical = new Set(["$and", "$or", "$nor", "$not"])
const scalar = new Set(["$eq", "$ne", "$in", "$nin", "$exists"])
const ordered = new Set(["$gt", "$gte", "$lt", "$lte"])
const strings = new Set([
  "$regex",
  "$like",
  "$ilike",
  "$contains",
  "$startsWith",
  "$endsWith",
])

function object(value: unknown): value is Filter {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function atPath(value: unknown, path: string): unknown {
  let result = value
  for (const key of path.split(".")) {
    if (!(object(result) && Object.hasOwn(result, key))) {
      return
    }
    result = result[key]
  }
  return result
}

function nullish(value: unknown): boolean {
  return value === undefined || value === null
}

function equal(value: unknown, operand: unknown): boolean {
  return operand === null ? nullish(value) : value === operand
}

function scalarCondition(
  value: unknown,
  op: string,
  operand: unknown
): boolean {
  switch (op) {
    case "$eq":
      return equal(value, operand)
    case "$ne":
      return !equal(value, operand)
    case "$in":
      return (operand as unknown[]).some((candidate) => equal(value, candidate))
    case "$nin":
      return !(operand as unknown[]).some((candidate) =>
        equal(value, candidate)
      )
    case "$exists":
      return (value !== undefined) === operand
    default:
      throw new Error(`Reference scalar operator ${op}`)
  }
}

function ordering(value: unknown, operand: unknown): number | undefined {
  if (nullish(value) || nullish(operand) || typeof value !== typeof operand) {
    return
  }
  if (typeof value === "string" && typeof operand === "string") {
    if (value === operand) {
      return 0
    }
    return value < operand ? -1 : 1
  }
  return Math.sign(Number(value) - Number(operand))
}

function orderedCondition(
  value: unknown,
  op: string,
  operand: unknown
): boolean {
  const result = ordering(value, operand)
  if (result === undefined) {
    return false
  }
  switch (op) {
    case "$gt":
      return result > 0
    case "$gte":
      return result >= 0
    case "$lt":
      return result < 0
    case "$lte":
      return result <= 0
    default:
      throw new Error(`Reference ordering operator ${op}`)
  }
}

function patternMatch(value: string, pattern: string): boolean {
  let regex = ""
  let escaped = false
  for (const character of pattern) {
    if (escaped) {
      regex += character.replace(SPECIAL, "\\$&")
      escaped = false
    } else if (character === "\\") {
      escaped = true
    } else if (character === "%") {
      regex += ".*"
    } else if (character === "_") {
      regex += "."
    } else {
      regex += character.replace(SPECIAL, "\\$&")
    }
  }
  if (escaped) {
    regex += "\\\\"
  }
  return new RegExp(`^(?:${regex})$(?![\\s\\S])`, "su").test(value)
}

function fold(value: string): string {
  return value.replace(ASCII_UPPER, (character) => character.toLowerCase())
}

function stringCondition(
  value: unknown,
  op: string,
  operand: unknown
): boolean {
  if (typeof value !== "string" || typeof operand !== "string") {
    return false
  }
  switch (op) {
    case "$regex":
      return new RegExp(operand, "u").test(value)
    case "$like":
      return patternMatch(value, operand)
    case "$ilike":
      return patternMatch(fold(value), fold(operand))
    case "$contains":
      return value.includes(operand)
    case "$startsWith":
      return value.startsWith(operand)
    case "$endsWith":
      return value.endsWith(operand)
    default:
      throw new Error(`Reference string operator ${op}`)
  }
}

function elementMatches(value: unknown, filter: Filter): boolean {
  const objectFilter = Object.keys(filter).some(
    (key) => !key.startsWith("$") || logical.has(key)
  )
  return objectFilter
    ? object(value) && matches(value, filter)
    : condition(value, filter)
}

function arrayCondition(value: unknown, op: string, operand: unknown): boolean {
  switch (op) {
    case "$all":
      return (operand as unknown[]).every(
        (candidate) =>
          Array.isArray(value) && value.some((item) => equal(item, candidate))
      )
    case "$size":
      return Array.isArray(value) && value.length === operand
    case "$elemMatch":
      return (
        Array.isArray(value) &&
        value.some((item) => elementMatches(item, operand as Filter))
      )
    case "$index": {
      const index = operand as { index: number; condition: unknown }
      return (
        Array.isArray(value) &&
        index.index < value.length &&
        condition(value[index.index], index.condition)
      )
    }
    default:
      throw new Error(`Reference array operator ${op}`)
  }
}

function operator(value: unknown, op: string, operand: unknown): boolean {
  if (scalar.has(op)) {
    return scalarCondition(value, op, operand)
  }
  if (ordered.has(op)) {
    return orderedCondition(value, op, operand)
  }
  if (strings.has(op)) {
    return stringCondition(value, op, operand)
  }
  return arrayCondition(value, op, operand)
}

function condition(value: unknown, expected: unknown): boolean {
  if (!object(expected)) {
    return equal(value, expected)
  }
  return Object.entries(expected).every(([op, operand]) =>
    operator(value, op, operand)
  )
}

function entry(value: unknown, key: string, operand: unknown): boolean {
  switch (key) {
    case "$and":
      return (operand as Filter[]).every((filter) => matches(value, filter))
    case "$or":
      return (operand as Filter[]).some((filter) => matches(value, filter))
    case "$nor":
      return !(operand as Filter[]).some((filter) => matches(value, filter))
    case "$not":
      return !matches(value, operand as Filter)
    default:
      return condition(atPath(value, key), operand)
  }
}

/** Independent evaluator: no production translator/resolver/string helpers. */
export function matches(value: unknown, filter: Filter): boolean {
  return Object.entries(filter).every(([key, operand]) =>
    entry(value, key, operand)
  )
}
