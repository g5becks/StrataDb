import { ValidationError } from "./errors.js"

function invalid(path: string, type: string): never {
  throw new ValidationError(
    `Unsupported JSON value at ${path || "<root>"}: ${type}${type === "Date" ? "; use an ISO string or epoch number" : ""}`
  )
}

function assertPlain(value: object, path: string): void {
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    invalid(path, prototype?.constructor?.name ?? "non-plain object")
  }
}

/** Validate and snapshot values before JSON.stringify can silently coerce them. */
function snapshot(
  value: unknown,
  path: string,
  ancestors: Set<object>,
  depth: number,
  _key: string
): unknown {
  if (depth > 256) {
    invalid(path, "maximum JSON depth exceeded")
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      invalid(path, `number (${String(value)})`)
    }
    return value
  }
  if (typeof value !== "object") {
    invalid(path, typeof value)
  }
  if (value instanceof Date) {
    invalid(path, "Date")
  }
  if (ancestors.has(value)) {
    invalid(path, "circular reference")
  }
  ancestors.add(value)
  try {
    const jsonValue = value as { toJSON?: (key: string) => unknown }
    if (typeof jsonValue.toJSON === "function") {
      return snapshot(jsonValue.toJSON(_key), path, ancestors, depth + 1, _key)
    }
    if (Array.isArray(value)) {
      return Array.from({ length: value.length }, (_, i) =>
        snapshot(value[i], `${path}[${i}]`, ancestors, depth + 1, String(i))
      )
    }
    assertPlain(value, path)
    const result: Record<string, unknown> = Object.create(null)
    for (const name of Object.keys(value)) {
      const item = (value as Record<string, unknown>)[name]
      if (item !== undefined) {
        result[name] = snapshot(
          item,
          path ? `${path}.${name}` : name,
          ancestors,
          depth + 1,
          name
        )
      }
    }
    return result
  } finally {
    ancestors.delete(value)
  }
}

export function serializeJSON(value: unknown, path = ""): string {
  try {
    return JSON.stringify(snapshot(value, path, new Set(), 0, ""))
  } catch (cause) {
    if (cause instanceof ValidationError) {
      throw cause
    }
    const error = new ValidationError(
      `Document JSON serialization failed at ${path || "<root>"}`
    )
    Object.defineProperty(error, "cause", { value: cause, configurable: true })
    throw error
  }
}
