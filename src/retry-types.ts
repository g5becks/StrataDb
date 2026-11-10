export type { RetryContext } from "p-retry"

/**
 * Configuration options for automatic retry with exponential backoff.
 *
 * @example
 * ```typescript
 * const options: RetryOptions = {
 *   retries: 3,
 *   factor: 2,
 *   minTimeout: 1000,
 *   maxTimeout: 30000,
 *   randomize: true
 * }
 * ```
 */
export type RetryOptions = {
  /**
   * Maximum number of retry attempts.
   * @default 0
   */
  retries?: number

  /**
   * Exponential backoff factor. Each retry delay is multiplied by this value.
   * @default 2
   */
  factor?: number

  /**
   * Minimum delay in milliseconds before the first retry.
   * @default 1000
   */
  minTimeout?: number

  /**
   * Maximum delay in milliseconds between retries.
   * @default 30000
   */
  maxTimeout?: number

  /**
   * Randomize timeout by multiplying with a factor between 1 and 2.
   * @default true
   */
  randomize?: boolean

  /**
   * Maximum total time in milliseconds for all retry attempts.
   * @default Infinity
   */
  maxRetryTime?: number

  /**
   * Callback invoked when a retry attempt fails.
   * Receives context with error details and retry state.
   * Runs after shouldConsumeRetry and before shouldRetry. Context includes
   * retryDelay in milliseconds. Aborted signals suppress remaining callbacks.
   *
   * @param context - Retry context containing error and attempt information
   */
  onFailedAttempt?: (
    context: import("p-retry").RetryContext
  ) => void | Promise<void>

  /**
   * Callback to determine if a retry should occur.
   * Return true to retry, false to abort with the error.
   *
   * @param context - Retry context containing error and attempt information
   * @returns Whether to retry the operation
   */
  shouldRetry?: (
    context: import("p-retry").RetryContext
  ) => boolean | Promise<boolean>

  /**
   * Callback to determine if a failure should consume a retry from the budget.
   * Return false to not count this failure against the retry limit.
   *
   * @param context - Retry context containing error and attempt information
   * @returns Whether this failure should consume a retry
   */
  shouldConsumeRetry?: (
    context: import("p-retry").RetryContext
  ) => boolean | Promise<boolean>
}
