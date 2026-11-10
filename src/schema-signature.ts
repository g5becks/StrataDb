import { SchemaValidationError } from "./errors.js"
import type { SchemaDefinition } from "./schema-types.js"

const functions = new WeakMap<object, number>()
let functionId = 0

function canonical(value: unknown, seen = new Set<object>()): unknown {
  if (typeof value === "function") {
    if (!functions.has(value)) {
      functionId += 1
      functions.set(value, functionId)
    }
    return ["function", functions.get(value)]
  }
  if (value === undefined) {
    return ["undefined"]
  }
  if (typeof value === "bigint") {
    return ["bigint", String(value)]
  }
  if (value === null || typeof value !== "object") {
    return [
      typeof value,
      typeof value === "number" && !Number.isFinite(value)
        ? String(value)
        : value,
    ]
  }
  if (seen.has(value)) {
    throw new SchemaValidationError("Circular schema metadata is unsupported")
  }
  seen.add(value)
  let result: unknown
  if (value instanceof Date) {
    result = ["date", value.toISOString()]
  } else if (value instanceof Uint8Array) {
    result = ["bytes", ...value]
  } else if (Array.isArray(value)) {
    result = ["array", value.map((item) => canonical(item, seen))]
  } else {
    result = [
      "object",
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item, seen)]),
    ]
  }
  seen.delete(value)
  return result
}

/** Hash declarative schema content; validators retain reference identity. */
export function schemaSignature<T>(schema: SchemaDefinition<T>): string {
  const normalized = {
    fields: schema.fields
      .map((field) => ({
        ...field,
        path: field.path ?? `$.${String(field.name)}`,
        indexed: field.indexed ?? false,
        unique: field.unique ?? false,
        nullable: field.nullable ?? false,
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    compoundIndexes: (schema.compoundIndexes ?? [])
      .map((index) => ({ ...index, unique: index.unique ?? false }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    timestamps: schema.timestamps ?? true,
    validate: schema.validate,
  }
  return new Bun.CryptoHasher("sha256")
    .update(JSON.stringify(canonical(normalized)))
    .digest("hex")
}
