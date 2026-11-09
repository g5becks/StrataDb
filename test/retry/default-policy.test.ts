import { expect, test } from "bun:test"
import {
  ConnectionError,
  ConstraintError,
  QueryError,
  SchemaValidationError,
  UniqueConstraintError,
  ValidationError,
} from "../../src/errors.js"
import { withRetry } from "../../src/retry-utils.js"

for (const error of [
  new ValidationError("validation"),
  new SchemaValidationError("schema"),
  new ConstraintError("constraint"),
  new UniqueConstraintError("unique"),
  new QueryError("query"),
  new Error("unknown"),
]) {
  test(`[TASK-261] default policy attempts ${error.name} only once`, async () => {
    let attempts = 0
    await expect(
      withRetry(
        () => {
          attempts += 1
          return Promise.reject(error)
        },
        { retries: 3, minTimeout: 1, maxTimeout: 1 }
      )
    ).rejects.toBe(error)
    expect(attempts).toBe(1)
  })
}

test("[TASK-261] custom predicate can retry an application error", async () => {
  let attempts = 0
  const result = await withRetry(
    () => {
      attempts += 1
      return attempts === 1
        ? Promise.reject(new Error("application transient"))
        : Promise.resolve("recovered")
    },
    {
      retries: 1,
      minTimeout: 1,
      shouldRetry: ({ error }) => error.message === "application transient",
    }
  )
  expect(result).toBe("recovered")
  expect(attempts).toBe(2)
})

test("[TASK-261] custom predicate can stop a normally retryable error", async () => {
  let attempts = 0
  const error = new ConnectionError("stop")
  await expect(
    withRetry(
      () => {
        attempts += 1
        return Promise.reject(error)
      },
      { retries: 3, shouldRetry: () => false }
    )
  ).rejects.toBe(error)
  expect(attempts).toBe(1)
})
