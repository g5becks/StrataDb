import { InvalidQueryOperatorError, QueryError } from "./errors.js"
import { assertNonNegativeInt, fieldPath } from "./field-resolver.js"

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  )
}

function assertScalar(value: unknown): void {
  if (
    value === null ||
    ["string", "number", "boolean", "bigint"].includes(typeof value) ||
    value instanceof Uint8Array
  ) {
    return
  }
  throw new QueryError("Operator requires a SQLite scalar value")
}

function validateCondition(value: unknown): void {
  if (isRecord(value)) {
    if (Object.keys(value).length === 0) {
      throw new QueryError("Field operator objects must not be empty")
    }
    for (const [operator, operand] of Object.entries(value)) {
      validateOperator(operator, operand)
    }
    return
  }
  assertScalar(value)
}

function validateOperator(operator: string, value: unknown): void {
  switch (operator) {
    case "$eq":
    case "$ne":
    case "$gt":
    case "$gte":
    case "$lt":
    case "$lte":
      assertScalar(value)
      return
    case "$in":
    case "$nin":
    case "$all":
      if (!Array.isArray(value)) {
        throw new QueryError(`${operator} requires an array`)
      }
      for (const element of value) {
        assertScalar(element)
      }
      return
    case "$size":
      assertNonNegativeInt(value, "$size")
      return
    case "$exists":
      if (typeof value !== "boolean") {
        throw new QueryError("$exists requires a boolean")
      }
      return
    case "$like":
    case "$ilike":
    case "$contains":
    case "$startsWith":
    case "$endsWith":
      if (typeof value !== "string") {
        throw new QueryError(`${operator} requires a string`)
      }
      return
    case "$index":
      validateIndex(value)
      return
    case "$elemMatch":
      validateElement(value)
      return
    default:
      if (operator.startsWith("$")) {
        throw new InvalidQueryOperatorError(
          `Unknown query operator ${operator}`
        )
      }
      throw new QueryError(`Expected an operator, received ${operator}`)
  }
}

/** Validate every branch before cache lookup or any SQL operation. */
export function validateQuery(filter: unknown): void {
  if (!isRecord(filter)) {
    throw new QueryError("A query filter must be a plain object")
  }
  for (const [key, value] of Object.entries(filter)) {
    switch (key) {
      case "$and":
      case "$or":
      case "$nor":
        if (!Array.isArray(value)) {
          throw new QueryError(`${key} requires an array of filters`)
        }
        for (const child of value) {
          validateQuery(child)
        }
        break
      case "$not":
        validateQuery(value)
        break
      default:
        if (key.startsWith("$")) {
          throw new InvalidQueryOperatorError(`Unknown query operator ${key}`)
        }
        fieldPath(key)
        validateCondition(value)
    }
  }
}

function validateIndex(value: unknown): void {
  if (
    !(
      isRecord(value) &&
      Object.hasOwn(value, "index") &&
      Object.hasOwn(value, "condition")
    )
  ) {
    throw new QueryError("$index requires index and condition")
  }
  for (const key of Object.keys(value)) {
    if (key !== "index" && key !== "condition") {
      if (key.startsWith("$")) {
        throw new InvalidQueryOperatorError(`Unknown operator ${key}`)
      }
      throw new QueryError(`Unexpected $index key ${key}`)
    }
  }
  assertNonNegativeInt(value.index, "$index.index")
  validateCondition(value.condition)
}

function validateElement(value: unknown): void {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    throw new QueryError("$elemMatch requires a nonempty object")
  }
  for (const [key, operand] of Object.entries(value)) {
    if (key.startsWith("$")) {
      validateOperator(key, operand)
    } else {
      fieldPath(key)
      validateCondition(operand)
    }
  }
}
