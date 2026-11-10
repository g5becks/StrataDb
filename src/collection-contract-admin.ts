import type { Document } from "./core-types.js"
import type { RetryOptions } from "./retry-types.js"
/** Admin members of {@link Collection}. */
export type CollectionAdminContract<T extends Document> = {
  /**
   * Drop the collection (delete the table).
   *
   * @returns Promise resolving when the collection is dropped
   *
   * @remarks
   * Permanently deletes the collection and all its documents.
   * This operation cannot be undone.
   *
   * The table and all associated indexes are removed from the database.
   * Use with caution in production environments.
   *
   * @example
   * ```typescript
   * // Drop a temporary collection
   * await tempCollection.drop();
   *
   * // Drop with confirmation
   * if (confirm('Really delete all users?')) {
   *   await users.drop();
   * }
   *
   * // With abort signal
   * const controller = new AbortController();
   * await collection.drop({ signal: controller.signal });
   * ```
   */
  drop(options?: {
    signal?: AbortSignal
    retry?: RetryOptions | false
  }): Promise<void>

  // ===== Validation =====

  /**
   * Validate a document against the schema (async).
   *
   * @param doc - Document to validate
   * @returns Promise resolving to true if valid
   *
   * @remarks
   * Validates the document against the schema validator.
   * Supports both synchronous and asynchronous validators.
   * Throws `ValidationError` if validation fails.
   *
   * @throws {ValidationError} If document fails validation
   *
   * @example
   * ```typescript
   * try {
   *   await users.validate({
   *     name: 'Alice',
   *     email: 'invalid-email',
   *     age: -5,
   *     role: 'admin'
   *   });
   * } catch (err) {
   *   if (err instanceof ValidationError) {
   *     console.error(`Invalid field: ${err.field}`);
   *     console.error(`Error: ${err.message}`);
   *   }
   * }
   *
   * // With abort signal
   * const controller = new AbortController();
   * await users.validate(doc, { signal: controller.signal });
   * ```
   */
  validate(
    doc: unknown,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<T>

  /**
   * Validate a document against the schema (sync).
   *
   * @param doc - Document to validate
   * @returns True if valid
   *
   * @remarks
   * Synchronous version of `validate()`. Only works with synchronous validators.
   * Throws error if the schema uses async validators.
   *
   * @throws {ValidationError} If document fails validation
   * @throws {TypeError} If schema uses async validators
   *
   * @example
   * ```typescript
   * try {
   *   users.validateSync({ name: 'Alice', email: 'alice@example.com', age: 30, role: 'admin' });
   *   console.log('Document is valid');
   * } catch (err) {
   *   console.error('Validation failed:', err.message);
   * }
   * ```
   */
  validateSync(doc: unknown): T

  /**
   * Cleans up event emitter resources.
   * Called internally when collection is dropped or database is closed.
   * @internal
   */
  cleanupEvents(): void
}
