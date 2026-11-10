import type { Database as SQLiteDatabase } from "bun:sqlite"
import type { CollectionBuilder } from "./collection-builder.js"
import type { Collection } from "./collection-types.js"
import type { Document } from "./core-types.js"
import type { RawChangeObserver } from "./raw-changes.js"
import type { RetryOptions } from "./retry-types.js"
import type { SchemaDriftHandler } from "./schema-evolution.js"
import type { SchemaDefinition } from "./schema-types.js"

/**
 * Options for creating a StrataDB instance.
 *
 * @example
 * ```typescript
 * const options: DatabaseOptions = {
 *   database: ':memory:',
 *   idGenerator: () => crypto.randomUUID(),
 *   onClose: () => console.log('Database closed')
 * };
 * const db = new StrataDB(options);
 * ```
 */
export type DatabaseOptions = {
  /** Opt-in SQLite row notifications, including raw SQL and uncommitted changes.
   * Requires exclusive hook ownership; callbacks must defer database reads.
   */
  readonly onRawChange?: RawChangeObserver
  /** Prepared statements per collection (positive integer, default 64). */
  readonly statementCacheSize?: number
  /** Report removed/type-changed generated columns; "error" rejects drift.
   * Defaults to console.warn. Columns and their data are retained.
   */
  readonly onSchemaDrift?: SchemaDriftHandler
  /**
   * SQLite database path or ':memory:' for in-memory database.
   * Can also be an existing bun:sqlite Database instance.
   */
  readonly database: string | SQLiteDatabase

  /** Open an existing database for reads only; collection setup never runs DDL. */
  readonly readonly?: boolean

  /**
   * Custom ID generator function. Defaults to crypto.randomUUID().
   */
  readonly idGenerator?: () => string

  /**
   * Callback invoked when database is closed.
   */
  readonly onClose?: () => void

  /**
   * Enable query caching for all collections.
   *
   * @remarks
   * When enabled, the query translator caches SQL templates for queries with the
   * same structure, improving performance for repeated queries at the cost of
   * memory usage (up to 500 cached query templates per collection).
   *
   * **Performance improvements with cache enabled:**
   * - Simple queries: ~23% faster
   * - Range queries: ~70% faster
   * - Complex queries: ~55% faster
   *
   * **Memory considerations:**
   * - Each collection maintains its own cache (up to 500 entries)
   * - Cache stores SQL strings and value extraction paths
   * - Use FIFO eviction when cache is full
   *
   * **When to enable:**
   * - Applications with repeated query patterns
   * - High-throughput read operations
   * - When performance is more critical than memory usage
   *
   * Individual collections can override this setting.
   *
   * @defaultValue false
   *
   * @see {@link CollectionOptions.enableCache} for per-collection override
   *
   * @example
   * ```typescript
   * // Enable caching for all collections (opt-in for performance)
   * const db = new StrataDB({ database: ':memory:', enableCache: true });
   *
   * // Disabled by default
   * const db = new StrataDB({ database: ':memory:' });
   * ```
   */
  readonly enableCache?: boolean

  /**
   * Default retry configuration for all database operations.
   *
   * @remarks
   * Provides automatic retry with exponential backoff for transient errors.
   * Individual collections and operations can override this setting.
   *
   * @defaultValue No retries (retries: 0)
   *
   * @see {@link CollectionOptions.retry} for per-collection override
   *
   * @example
   * ```typescript
   * const db = new StrataDB({
   *   database: 'app.db',
   *   retry: { retries: 3, minTimeout: 1000, maxTimeout: 30000 }
   * });
   * ```
   */
  readonly retry?: RetryOptions
}

/**
 * Options for creating a collection.
 *
 * @remarks
 * Collection-specific options that can override database-level defaults.
 *
 * @example
 * ```typescript
 * // Override database-level cache setting for a specific collection
 * const users = db.collection('users', userSchema, { enableCache: false });
 * ```
 */
export type CollectionOptions = {
  /** Override the database prepared-statement LRU capacity (default 64). */
  readonly statementCacheSize?: number
  /**
   * Enable query caching for this collection.
   *
   * @remarks
   * Overrides the database-level `enableCache` setting for this specific collection.
   * When enabled, the query translator caches SQL templates for queries with the
   * same structure, improving performance for repeated queries at the cost of
   * memory usage (up to 500 cached query templates).
   *
   * **Use cases for enabling cache on specific collections:**
   * - Collections with frequent repeated queries (e.g., user lookups)
   * - High-read collections in performance-critical paths
   * - Collections with stable query patterns
   *
   * **Use cases for disabling cache on specific collections:**
   * - Log/audit collections with varied queries
   * - Low-frequency access collections
   * - Memory-constrained environments
   *
   * @defaultValue Inherits from database-level setting (false by default)
   *
   * @see {@link DatabaseOptions.enableCache} for global default
   *
   * @example
   * ```typescript
   * // Enable cache for a high-traffic collection
   * const users = db.collection('users', userSchema, { enableCache: true });
   *
   * // Explicitly disable cache for a collection
   * const logs = db.collection('logs', logSchema, { enableCache: false });
   * ```
   */
  readonly enableCache?: boolean

  /**
   * Retry configuration for this collection.
   *
   * @remarks
   * Overrides the database-level `retry` setting for this specific collection.
   * Pass `false` to explicitly disable retries for this collection.
   *
   * @defaultValue Inherits from database-level setting (no retries by default)
   *
   * @see {@link DatabaseOptions.retry} for global default
   *
   * @example
   * ```typescript
   * // Enable retries for a specific collection
   * const users = db.collection('users', userSchema, {
   *   retry: { retries: 3, minTimeout: 1000 }
   * });
   *
   * // Disable retries for a collection
   * const logs = db.collection('logs', logSchema, { retry: false });
   * ```
   */
  readonly retry?: RetryOptions | false
}

/**
 * Transaction interface for atomic multi-operation execution.
 *
 * @remarks
 * Transactions ensure that multiple operations either all succeed or all fail.
 * Uses SQLite's transaction support underneath. Implements Symbol.dispose for
 * automatic rollback if commit is not called.
 *
 * @example
 * ```typescript
 * // Using try/finally pattern
 * const tx = db.transaction();
 * try {
 *   const users = tx.collection('users', userSchema);
 *   await users.insertOne({ name: 'Alice' });
 *   await users.insertOne({ name: 'Bob' });
 *   tx.commit();
 * } catch (error) {
 *   tx.rollback();
 *   throw error;
 * }
 *
 * // Using Symbol.dispose (automatic rollback on scope exit)
 * using tx = db.transaction();
 * const users = tx.collection('users', userSchema);
 * await users.insertOne({ name: 'Alice' });
 * tx.commit(); // Must call commit, otherwise rollback on scope exit
 * ```
 */
export type Transaction = {
  /**
   * Gets a collection within this transaction.
   *
   * @param name - Collection name
   * @param schema - Schema definition for the collection
   * @returns Collection bound to this transaction
   */
  collection<T extends Document>(
    name: string,
    schema: SchemaDefinition<T>,
    options?: CollectionOptions
  ): Collection<T>

  /**
   * Commits all changes made within this transaction.
   */
  commit(): void

  /**
   * Rolls back all changes made within this transaction.
   */
  rollback(): void

  /**
   * Disposes the transaction (rolls back if not committed).
   * Enables `using tx = db.transaction()` syntax.
   */
  [Symbol.dispose](): void
}

/**
 * Main StrataDB interface for database operations.
 *
 * @remarks
 * StrataDB provides a MongoDB-like API backed by SQLite. It manages collections,
 * transactions, and database lifecycle. Implements Symbol.dispose for automatic cleanup.
 *
 * @example
 * ```typescript
 * // Create database
 * const db = new StrataDB({ database: 'myapp.db' });
 *
 * // Get or create a collection
 * const users = db.collection('users', userSchema);
 *
 * // Insert documents
 * await users.insertOne({ name: 'Alice', email: 'alice@example.com' });
 *
 * // Query documents
 * const adults = await users.find({ age: { $gte: 18 } });
 *
 * // Close database when done
 * db.close();
 * ```
 */
export type StrataDB = {
  /**
   * Direct access to the underlying SQLite database.
   * Use for advanced operations not covered by StrataDB API.
   */
  readonly sqliteDb: SQLiteDatabase

  /**
   * Generates a new unique ID using the configured ID generator.
   *
   * @returns A new unique identifier string
   */
  generateId(): string

  /**
   * Gets or creates a collection with a pre-built schema.
   *
   * @param name - Collection name (table name in SQLite)
   * @param schema - Schema definition for type safety and validation
   * @param options - Optional collection-specific configuration
   * @returns Collection instance for the specified type
   *
   * @example
   * ```typescript
   * // Default cache behavior (inherits from database)
   * const users = db.collection('users', userSchema);
   *
   * // Override cache setting for this collection
   * const logs = db.collection('logs', logSchema, { enableCache: false });
   * ```
   */
  collection<T extends Document>(
    name: string,
    schema: SchemaDefinition<T>,
    options?: CollectionOptions
  ): Collection<T>

  /**
   * Creates a collection builder for fluent schema definition.
   *
   * @param name - Collection name (table name in SQLite)
   * @returns CollectionBuilder for defining schema inline
   *
   * @example
   * ```typescript
   * const users = db.collection<User>('users')
   *   .field('name', { type: 'TEXT', indexed: true })
   *   .field('email', { type: 'TEXT', indexed: true, unique: true })
   *   .build();
   * ```
   */
  collection<T extends Document>(name: string): CollectionBuilder<T>

  /**
   * Creates a new transaction for atomic operations.
   *
   * @returns Transaction instance
   *
   * @example
   * ```typescript
   * using tx = db.transaction();
   * // operations...
   * tx.commit();
   * ```
   */
  transaction(): Transaction

  /**
   * Executes a function within a transaction.
   *
   * @param fn - Function to execute within transaction
   * @param options - Optional options including signal for cancellation
   * @returns Result of the function
   *
   * @remarks
   * Automatically commits on success, rolls back on error.
   *
   * @example
   * ```typescript
   * await db.execute(async (tx) => {
   *   const users = tx.collection('users', userSchema);
   *   await users.insertOne({ name: 'Alice' });
   *   await users.insertOne({ name: 'Bob' });
   * });
   *
   * // With abort signal
   * const controller = new AbortController();
   * await db.execute(async (tx) => {
   *   // transaction operations
   * }, { signal: controller.signal });
   * ```
   */
  execute<R>(
    fn: (tx: Transaction) => R | Promise<R>,
    options?: { signal?: AbortSignal }
  ): Promise<R>

  /**
   * Closes the database connection.
   */
  close(): void

  /**
   * Disposes the database (closes connection).
   * Enables `using db = new StrataDB(...)` syntax.
   */
  [Symbol.dispose](): void
}
