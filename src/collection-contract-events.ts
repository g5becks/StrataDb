import type {
  CollectionEventMap,
  CollectionEventName,
} from "./collection-events.js"
import type { Collection } from "./collection-types.js"
import type { Document } from "./core-types.js"
/** @inline */
export type CollectionEventsContract<T extends Document> = {
  // ===== Event Methods =====

  /**
   * Register an event listener for collection events.
   *
   * @typeParam E - The event name type
   * @param event - The event name to listen for
   * @param listener - The callback function to invoke when the event is emitted
   * @returns The collection instance for method chaining
   *
   * @remarks
   * Registers a listener function that will be called whenever the specified
   * event is emitted. The listener receives the event payload as its argument.
   *
   * The event emitter is lazily initialized on the first call to `on()`,
   * ensuring zero overhead when events are not used.
   *
   * All events are emitted **after** the operation completes successfully.
   * Events do not fire if the operation throws an error (except for 'error' events).
   *
   * @example
   * ```typescript
   * // Audit logging
   * users.on('insert', (event) => {
   *   console.log(`New user created: ${event.document._id}`)
   *   auditLog.record('user.created', event.document)
   * })
   *
   * // Cache invalidation
   * users.on('update', (event) => {
   *   if (event.document) {
   *     cache.invalidate(`user:${event.document._id}`)
   *   }
   * })
   *
   * // Error monitoring
   * users.on('error', (event) => {
   *   errorTracker.capture(event.error, {
   *     operation: event.operation,
   *     context: event.context
   *   })
   * })
   *
   * // Method chaining
   * users
   *   .on('insert', logInsert)
   *   .on('update', logUpdate)
   *   .on('delete', logDelete)
   * ```
   */
  on<E extends CollectionEventName>(
    event: E,
    listener: (...args: CollectionEventMap<T>[E]) => void
  ): Collection<T>

  /**
   * Register a one-time event listener.
   *
   * @typeParam E - The event name type
   * @param event - The event name to listen for
   * @param listener - The callback function to invoke once
   * @returns The collection instance for method chaining
   *
   * @remarks
   * Registers a listener that will be automatically removed after it is
   * invoked once. Useful for setup tasks or one-time notifications.
   *
   * @example
   * ```typescript
   * // Log only the first user creation
   * users.once('insert', (event) => {
   *   console.log('First user created:', event.document._id)
   * })
   *
   * // One-time initialization
   * users.once('insert', async (event) => {
   *   await initializeUserMetrics()
   * })
   * ```
   */
  once<E extends CollectionEventName>(
    event: E,
    listener: (...args: CollectionEventMap<T>[E]) => void
  ): Collection<T>

  /**
   * Remove an event listener.
   *
   * @typeParam E - The event name type
   * @param event - The event name
   * @param listener - The callback function to remove
   * @returns The collection instance for method chaining
   *
   * @remarks
   * Removes a previously registered listener. The listener reference must
   * be the same function reference that was passed to `on()` or `once()`.
   *
   * If the listener was not registered, this method has no effect.
   *
   * @example
   * ```typescript
   * // Define listener function
   * const logInsert = (event: InsertEvent<User>) => {
   *   console.log('User inserted:', event.document._id)
   * }
   *
   * // Register listener
   * users.on('insert', logInsert)
   *
   * // Later, remove it
   * users.off('insert', logInsert)
   *
   * // Note: Arrow functions must use the same reference
   * const listener = (event) => console.log(event)
   * users.on('insert', listener)
   * users.off('insert', listener) // Works
   *
   * // This won't work (different function reference):
   * users.on('insert', (event) => console.log(event))
   * users.off('insert', (event) => console.log(event)) // Does nothing
   * ```
   */
  off<E extends CollectionEventName>(
    event: E,
    listener: (...args: CollectionEventMap<T>[E]) => void
  ): Collection<T>

  /**
   * Remove all listeners for an event, or all events if no event specified.
   *
   * @param event - Optional event name to clear listeners for
   * @returns The collection instance for method chaining
   *
   * @remarks
   * If an event name is provided, removes all listeners for that event.
   * If no event name is provided, removes all listeners for all events.
   *
   * Use with caution in shared codebases where multiple parts of the
   * application might be listening to the same events.
   *
   * @example
   * ```typescript
   * // Remove all 'insert' listeners
   * users.removeAllListeners('insert')
   *
   * // Remove all listeners for all events
   * users.removeAllListeners()
   *
   * // Cleanup before disposal
   * function cleanup() {
   *   users.removeAllListeners()
   *   db.close()
   * }
   * ```
   */
  removeAllListeners(event?: CollectionEventName): Collection<T>

  /**
   * Get the number of listeners for an event.
   *
   * @param event - The event name
   * @returns Number of registered listeners for the event
   *
   * @remarks
   * Returns the count of listeners currently registered for the specified event.
   * Useful for debugging or monitoring event listener usage.
   *
   * Returns 0 if no listeners are registered or if the event emitter
   * has not been initialized yet.
   *
   * @example
   * ```typescript
   * // Check if anyone is listening
   * if (users.listenerCount('insert') === 0) {
   *   console.log('No insert listeners registered')
   * }
   *
   * // Monitor listener count
   * users.on('insert', listener1)
   * users.on('insert', listener2)
   * console.log(users.listenerCount('insert')) // 2
   *
   * users.off('insert', listener1)
   * console.log(users.listenerCount('insert')) // 1
   * ```
   */
  listenerCount(event: CollectionEventName): number

  /**
   * Get all listeners for an event.
   *
   * @typeParam E - The event name type
   * @param event - The event name
   * @returns Array of listener functions registered for the event
   *
   * @remarks
   * Returns an array of all listener functions currently registered for
   * the specified event. The array is a copy, so modifying it won't affect
   * the actual listeners.
   *
   * Returns an empty array if no listeners are registered or if the event
   * emitter has not been initialized yet.
   *
   * @example
   * ```typescript
   * // Get all insert listeners
   * const insertListeners = users.listeners('insert')
   * console.log(`${insertListeners.length} listeners registered`)
   *
   * // Iterate over listeners
   * for (const listener of users.listeners('update')) {
   *   console.log('Listener:', listener.name)
   * }
   *
   * // Check if specific listener is registered
   * const hasListener = users.listeners('delete').includes(myListener)
   * ```
   */
  listeners<E extends CollectionEventName>(
    event: E
  ): ((...args: CollectionEventMap<T>[E]) => void)[]
}
