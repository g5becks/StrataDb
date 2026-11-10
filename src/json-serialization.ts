import { ValidationError } from "./errors.js"

export function serializeJSON(value: object): string {
  try {
    return JSON.stringify(value)
  } catch (cause) {
    const error = new ValidationError(
      "Document must be JSON serializable (circular references are unsupported)"
    )
    Object.defineProperty(error, "cause", { value: cause, configurable: true })
    throw error
  }
}
