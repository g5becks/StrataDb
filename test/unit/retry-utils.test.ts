import { Database, SQLiteError } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import {
  ConnectionError,
  ConstraintError,
  SchemaValidationError,
  TransactionError,
  UniqueConstraintError,
  ValidationError,
} from "../../src/errors.js"
import {
  defaultShouldRetry,
  mergeRetryOptions,
  withRetry,
} from "../../src/retry-utils.js"

function sqliteError(errno: number): SQLiteError {
  using db = new Database(":memory:")
  try {
    db.exec("INVALID SQL")
  } catch (error) {
    if (!(error instanceof SQLiteError)) {
      throw error
    }
    // Native errno is immutable; inherit the native error for fault-injected
    // result-code variants that cannot safely be induced (e.g. NOMEM/IOERR).
    return Object.create(error, { errno: { value: errno } }) as SQLiteError
  }
  throw new Error("Expected SQLiteError")
}

test("[TASK-254] p-retry 9 callback order and retryDelay are exposed", async () => {
  const calls: string[] = []
  let attempts = 0
  expect(
    await withRetry(
      () => {
        attempts += 1
        return attempts === 1
          ? Promise.reject(new Error("transient"))
          : Promise.resolve("ok")
      },
      {
        retries: 1,
        minTimeout: 1,
        maxTimeout: 1,
        randomize: false,
        shouldConsumeRetry: () => {
          calls.push("consume")
          return true
        },
        onFailedAttempt: (context) => {
          calls.push("failed")
          expect(context.retryDelay).toBe(1)
        },
        shouldRetry: () => {
          calls.push("retry")
          return true
        },
      }
    )
  ).toBe("ok")
  expect(calls).toEqual(["consume", "failed", "retry"])
  expect(attempts).toBe(2)
})

test("[TASK-254] abort during an attempt wins and suppresses retry callbacks", async () => {
  const controller = new AbortController()
  const reason = new Error("cancelled")
  let callbacks = 0
  const promise = withRetry(
    () => {
      controller.abort(reason)
      return Promise.reject(new Error("attempt failure"))
    },
    {
      retries: 2,
      signal: controller.signal,
      shouldConsumeRetry: () => {
        callbacks += 1
        return true
      },
      onFailedAttempt: () => {
        callbacks += 1
      },
      shouldRetry: () => {
        callbacks += 1
        return true
      },
    }
  )
  await expect(promise).rejects.toBe(reason)
  expect(callbacks).toBe(0)
})

describe("withRetry", () => {
  test("executes operation once when retries is 0", async () => {
    let callCount = 0
    // biome-ignore lint/suspicious/useAwait: test helper needs to be async
    const operation = async () => {
      callCount += 1
      return Promise.resolve("success")
    }

    const result = await withRetry(operation, { retries: 0 })

    expect(result).toBe("success")
    expect(callCount).toBe(1)
  })

  test("executes operation once when retries is undefined", async () => {
    let callCount = 0
    // biome-ignore lint/suspicious/useAwait: test helper needs to be async
    const operation = async () => {
      callCount += 1
      return Promise.resolve("success")
    }

    const result = await withRetry(operation)

    expect(result).toBe("success")
    expect(callCount).toBe(1)
  })

  test("retries on retryable errors", async () => {
    let callCount = 0
    // biome-ignore lint/suspicious/useAwait: test helper needs to be async
    const operation = async () => {
      callCount += 1
      if (callCount < 3) {
        throw new ConnectionError("Connection failed")
      }
      return Promise.resolve("success")
    }

    const result = await withRetry(operation, {
      retries: 3,
      minTimeout: 1,
      maxTimeout: 1,
    })

    expect(result).toBe("success")
    expect(callCount).toBe(3)
  })

  test("stops on non-retryable errors", async () => {
    let callCount = 0
    // biome-ignore lint/suspicious/useAwait: test helper needs to be async
    const operation = async () => {
      callCount += 1
      throw new ValidationError("Invalid data", "field", "value")
    }

    try {
      await withRetry(operation, {
        retries: 3,
        minTimeout: 1,
        shouldRetry: defaultShouldRetry,
      })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect(callCount).toBe(1)
    }
  })

  test("respects maxRetryTime", async () => {
    // biome-ignore lint/suspicious/useAwait: test helper needs to be async
    const operation = async () => {
      throw new ConnectionError("Connection failed")
    }

    const startTime = Date.now()
    try {
      await withRetry(operation, {
        retries: 100,
        minTimeout: 10,
        maxRetryTime: 50,
      })
      expect.unreachable()
    } catch {
      const elapsed = Date.now() - startTime
      expect(elapsed).toBeLessThan(200)
    }
  })

  test("calls onFailedAttempt on each failure", async () => {
    const attempts: number[] = []
    let callCount = 0
    // biome-ignore lint/suspicious/useAwait: test helper needs to be async
    const operation = async () => {
      callCount += 1
      if (callCount < 3) {
        throw new ConnectionError("Connection failed")
      }
      return Promise.resolve("success")
    }

    await withRetry(operation, {
      retries: 3,
      minTimeout: 1,
      maxTimeout: 1,
      onFailedAttempt: (context) => {
        attempts.push(context.attemptNumber)
      },
    })

    expect(attempts).toEqual([1, 2])
  })

  test("respects shouldRetry predicate", async () => {
    let callCount = 0
    // biome-ignore lint/suspicious/useAwait: test helper needs to be async
    const operation = async () => {
      callCount += 1
      throw new Error("Custom error")
    }

    try {
      await withRetry(operation, {
        retries: 3,
        minTimeout: 1,
        shouldRetry: () => false,
      })
      expect.unreachable()
    } catch {
      expect(callCount).toBe(1)
    }
  })

  test("respects shouldConsumeRetry predicate", async () => {
    let callCount = 0
    // biome-ignore lint/suspicious/useAwait: test helper needs to be async
    const operation = async () => {
      callCount += 1
      throw new Error("Custom error")
    }

    try {
      await withRetry(operation, {
        retries: 2,
        minTimeout: 1,
        maxTimeout: 1,
        shouldConsumeRetry: () => false,
        shouldRetry: () => true,
        maxRetryTime: 50,
      })
      expect.unreachable()
    } catch {
      // Should retry many times without consuming retries, until maxRetryTime
      expect(callCount).toBeGreaterThan(2)
    }
  })
})

describe("mergeRetryOptions", () => {
  test("returns undefined when operation-level is false", () => {
    const result = mergeRetryOptions({ retries: 3 }, { retries: 5 }, false)

    expect(result).toBeUndefined()
  })

  test("returns undefined when collection-level is false", () => {
    const result = mergeRetryOptions({ retries: 3 }, false, { retries: 5 })

    expect(result).toBeUndefined()
  })

  test("merges options with correct precedence", () => {
    const result = mergeRetryOptions(
      { retries: 3, minTimeout: 1000, factor: 2 },
      { retries: 5, minTimeout: 2000 },
      { maxTimeout: 10_000 }
    )

    expect(result).toEqual({
      retries: 5,
      minTimeout: 2000,
      factor: 2,
      maxTimeout: 10_000,
    })
  })

  test("handles undefined options", () => {
    const result = mergeRetryOptions(undefined, undefined, { retries: 3 })

    expect(result).toEqual({ retries: 3 })
  })

  test("returns empty object when all options are undefined", () => {
    const result = mergeRetryOptions()

    expect(result).toEqual({})
  })
})

describe("defaultShouldRetry", () => {
  test("returns false for ValidationError", () => {
    const error = new ValidationError("Invalid", "field", "value")
    const result = defaultShouldRetry({
      error,
      attemptNumber: 1,
      retriesLeft: 2,
      retriesConsumed: 0,
    })

    expect(result).toBe(false)
  })

  test("returns false for SchemaValidationError", () => {
    const error = new SchemaValidationError("Invalid schema", "field")
    const result = defaultShouldRetry({
      error,
      attemptNumber: 1,
      retriesLeft: 2,
      retriesConsumed: 0,
    })

    expect(result).toBe(false)
  })

  test("returns false for UniqueConstraintError", () => {
    const error = new UniqueConstraintError("Duplicate", "field")
    const result = defaultShouldRetry({
      error,
      attemptNumber: 1,
      retriesLeft: 2,
      retriesConsumed: 0,
    })

    expect(result).toBe(false)
  })

  test("returns false for ConstraintError", () => {
    const error = new ConstraintError("Constraint failed")
    const result = defaultShouldRetry({
      error,
      attemptNumber: 1,
      retriesLeft: 2,
      retriesConsumed: 0,
    })

    expect(result).toBe(false)
  })

  test("returns true for ConnectionError", () => {
    const error = new ConnectionError("Connection failed")
    const result = defaultShouldRetry({
      error,
      attemptNumber: 1,
      retriesLeft: 2,
      retriesConsumed: 0,
    })

    expect(result).toBe(true)
  })

  test("returns true for TransactionError", () => {
    const error = new TransactionError("Transaction failed")
    const result = defaultShouldRetry({
      error,
      attemptNumber: 1,
      retriesLeft: 2,
      retriesConsumed: 0,
    })

    expect(result).toBe(true)
  })

  test("returns true for SQLITE_BUSY (errno 5)", () => {
    const error = sqliteError(5)
    const result = defaultShouldRetry({
      error,
      attemptNumber: 1,
      retriesLeft: 2,
      retriesConsumed: 0,
    })

    expect(result).toBe(true)
  })

  test("returns true for SQLITE_LOCKED (errno 6)", () => {
    const error = sqliteError(6)
    const result = defaultShouldRetry({
      error,
      attemptNumber: 1,
      retriesLeft: 2,
      retriesConsumed: 0,
    })

    expect(result).toBe(true)
  })

  test("returns true for SQLITE_NOMEM (errno 7)", () => {
    const error = sqliteError(7)
    const result = defaultShouldRetry({
      error,
      attemptNumber: 1,
      retriesLeft: 2,
      retriesConsumed: 0,
    })

    expect(result).toBe(true)
  })

  test("returns true for SQLITE_IOERR (errno 10)", () => {
    const error = sqliteError(10)
    const result = defaultShouldRetry({
      error,
      attemptNumber: 1,
      retriesLeft: 2,
      retriesConsumed: 0,
    })

    expect(result).toBe(true)
  })

  test.each([
    517, 262, 266,
  ])("returns true for extended SQLite errno %i", (errno) => {
    const error = sqliteError(errno)
    expect(error).toBeInstanceOf(SQLiteError)
    expect(
      defaultShouldRetry({
        error,
        attemptNumber: 1,
        retriesLeft: 2,
        retriesConsumed: 0,
      })
    ).toBe(true)
  })

  test("returns false for unknown errors", () => {
    const error = new Error("Unknown error")
    const result = defaultShouldRetry({
      error,
      attemptNumber: 1,
      retriesLeft: 2,
      retriesConsumed: 0,
    })

    expect(result).toBe(false)
  })

  test("returns false for non-retryable SQLite codes", () => {
    const error = sqliteError(99)
    const result = defaultShouldRetry({
      error,
      attemptNumber: 1,
      retriesLeft: 2,
      retriesConsumed: 0,
    })

    expect(result).toBe(false)
  })
})
