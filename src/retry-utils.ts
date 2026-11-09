import pRetry from "p-retry"
import {
  ConnectionError,
  ConstraintError,
  SchemaValidationError,
  TransactionError,
  UniqueConstraintError,
  ValidationError,
} from "./errors.js"
import type { RetryContext, RetryOptions } from "./retry-types.js"

/**
 * SQLite error codes that are safe to retry.
 * - 5: SQLITE_BUSY - database is locked
 * - 6: SQLITE_LOCKED - table is locked
 * - 7: SQLITE_NOMEM - out of memory
 * - 10: SQLITE_IOERR - disk I/O error
 */
export const RETRYABLE_SQLITE_CODES = [5, 6, 7, 10] as const

/**
 * Retry options with optional AbortSignal support.
 */
export type RetryableOptions = RetryOptions & {
  signal?: AbortSignal
}

/**
 * Default retry logic for database operations.
 * Determines which errors should trigger a retry attempt.
 *
 * @param context - Retry context containing error and attempt information
 * @returns true if the operation should be retried, false otherwise
 *
 * @example
 * ```typescript
 * const options: RetryOptions = {
 *   retries: 3,
 *   shouldRetry: defaultShouldRetry
 * }
 * ```
 */
export function defaultShouldRetry(context: RetryContext): boolean {
  const { error } = context

  // Never retry validation errors
  if (error instanceof ValidationError) {
    return false
  }
  if (error instanceof SchemaValidationError) {
    return false
  }
  if (error instanceof UniqueConstraintError) {
    return false
  }
  if (error instanceof ConstraintError) {
    return false
  }

  // Always retry connection and transaction errors
  if (error instanceof ConnectionError) {
    return true
  }
  if (error instanceof TransactionError) {
    return true
  }

  // Bun exposes numeric extended result codes as errno; code is a string.
  if ("errno" in error && typeof error.errno === "number") {
    // biome-ignore lint/suspicious/noBitwiseOperators: SQLite primary result code occupies the low byte
    const primaryCode = error.errno & 0xff
    return RETRYABLE_SQLITE_CODES.some((code) => code === primaryCode)
  }

  // Don't retry unknown errors
  return false
}

/**
 * Wraps an async operation with automatic retry logic.
 *
 * @param operation - The async function to execute with retry
 * @param options - Retry configuration options
 * @returns The result of the operation
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => db.execute('SELECT * FROM users'),
 *   { retries: 3, signal: abortController.signal }
 * )
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options?: RetryableOptions
): Promise<T> {
  // Skip retry wrapper if retries is 0 or undefined
  if (!options?.retries) {
    return await operation()
  }

  const pRetryOptions: Record<string, unknown> = {
    retries: options.retries,
  }

  if (options.factor !== undefined) {
    pRetryOptions.factor = options.factor
  }
  if (options.minTimeout !== undefined) {
    pRetryOptions.minTimeout = options.minTimeout
  }
  if (options.maxTimeout !== undefined) {
    pRetryOptions.maxTimeout = options.maxTimeout
  }
  if (options.randomize !== undefined) {
    pRetryOptions.randomize = options.randomize
  }
  if (options.maxRetryTime !== undefined) {
    pRetryOptions.maxRetryTime = options.maxRetryTime
  }
  if (options.onFailedAttempt !== undefined) {
    pRetryOptions.onFailedAttempt = options.onFailedAttempt
  }
  if (options.shouldRetry !== undefined) {
    pRetryOptions.shouldRetry = options.shouldRetry
  }
  if (options.shouldConsumeRetry !== undefined) {
    pRetryOptions.shouldConsumeRetry = options.shouldConsumeRetry
  }
  if (options.signal !== undefined) {
    pRetryOptions.signal = options.signal
  }

  return await pRetry(operation, pRetryOptions as Parameters<typeof pRetry>[1])
}

/**
 * Merges retry options from database, collection, and operation levels.
 * Operation-level options take precedence over collection-level, which take precedence over database-level.
 *
 * @param database - Database-level retry options
 * @param collection - Collection-level retry options
 * @param operation - Operation-level retry options
 * @returns Merged retry options, or undefined if retry is disabled
 *
 * @example
 * ```typescript
 * const options = mergeRetryOptions(
 *   { retries: 3 },
 *   { retries: 5, minTimeout: 2000 },
 *   { maxTimeout: 10000 }
 * )
 * // Result: { retries: 5, minTimeout: 2000, maxTimeout: 10000 }
 * ```
 */
export function mergeRetryOptions(
  database?: RetryOptions | false,
  collection?: RetryOptions | false,
  operation?: RetryOptions | false
): RetryOptions | undefined {
  // Operation-level false disables retry
  if (operation === false) {
    return
  }

  // Collection-level false disables retry
  if (collection === false) {
    return
  }

  // Merge with precedence: operation > collection > database
  return {
    ...database,
    ...collection,
    ...operation,
  } as RetryOptions
}
