import { Database as SQLiteDatabase } from "bun:sqlite"
import { throwIfAborted } from "./abort-utils.js"
import {
  type CollectionBuilder,
  CollectionBuilderImpl,
} from "./collection-builder.js"
import type { Collection } from "./collection-types.js"
import type { Document } from "./core-types.js"
import type {
  CollectionOptions,
  DatabaseOptions,
  StrataDB as StrataDBInterface,
  Transaction,
} from "./database-types.js"
import { ConnectionError } from "./errors.js"
import { generateId } from "./id-generator.js"
import type { RetryOptions } from "./retry-types.js"
import type { SchemaDefinition } from "./schema-types.js"
import { SQLiteCollection } from "./sqlite-collection.js"

/**
 * Main StrataDB database class.
 *
 * @remarks
 * StrataDB provides a MongoDB-like document database API backed by SQLite.
 * It manages collections, transactions, and database lifecycle.
 *
 * **Features:**
 * - Type-safe document operations
 * - JSONB storage with indexed generated columns
 * - Transaction support with automatic rollback
 * - Symbol.dispose for automatic cleanup
 *
 * @example
 * ```typescript
 * // Create database with path
 * const db = new Strata({ database: 'myapp.db' });
 *
 * // Create in-memory database
 * const memDb = new Strata({ database: ':memory:' });
 *
 * // With custom options
 * const customDb = new Strata({
 *   database: 'app.db',
 *   idGenerator: () => `custom-${Date.now()}`,
 *   onClose: () => console.log('Database closed'),
 *   debug: true
 * });
 *
 * // Using with automatic cleanup
 * using db = new Strata({ database: ':memory:' });
 * const users = db.collection('users', userSchema);
 * // Database automatically closes when scope exits
 * ```
 */
export class Strata implements StrataDBInterface {
  readonly sqliteDb: SQLiteDatabase

  private readonly idGeneratorFn: () => string
  private readonly onCloseCallback: (() => void) | undefined
  private readonly enableCacheDefault: boolean
  private readonly retryOptionsDefault: RetryOptions | undefined
  private readonly collections = new Map<string, Collection<Document>>()

  /**
   * Creates a new StrataDB instance.
   *
   * @param options - Database configuration options
   */
  constructor(options: DatabaseOptions) {
    // Initialize database connection
    if (typeof options.database === "string") {
      this.sqliteDb = new SQLiteDatabase(options.database)
    } else {
      this.sqliteDb = options.database
    }

    const version =
      this.sqliteDb
        .query<{ version: string }, []>("SELECT sqlite_version() AS version")
        .get()?.version ?? "unknown"
    const [major = 0, minor = 0] = version.split(".").map(Number)
    if (!(major > 3 || (major === 3 && minor >= 45))) {
      if (typeof options.database === "string") {
        this.sqliteDb.close()
      }
      throw new ConnectionError(
        `SQLite ${version} is unsupported; StrataDB requires SQLite >= 3.45.0 for JSONB. On macOS, call Database.setCustomSQLite() before opening a database to load a newer SQLite library.`
      )
    }

    this.idGeneratorFn = options.idGenerator ?? generateId
    this.onCloseCallback = options.onClose
    this.enableCacheDefault = options.enableCache ?? false
    this.retryOptionsDefault = options.retry
  }

  /**
   * Generates a new unique ID using the configured ID generator.
   *
   * @returns A new unique identifier string
   */
  generateId(): string {
    return this.idGeneratorFn()
  }

  /**
   * Gets or creates a collection with a pre-built schema.
   */
  collection<T extends Document>(
    name: string,
    schema: SchemaDefinition<T>,
    options?: CollectionOptions
  ): Collection<T>

  /**
   * Creates a collection builder for fluent schema definition.
   */
  collection<T extends Document>(name: string): CollectionBuilder<T>

  /**
   * Implementation of overloaded collection method.
   */
  collection<T extends Document>(
    name: string,
    schema?: SchemaDefinition<T>,
    options?: CollectionOptions
  ): Collection<T> | CollectionBuilder<T> {
    if (!schema) {
      // Return builder for fluent schema definition
      return new CollectionBuilderImpl<T>(
        this.sqliteDb,
        name,
        this.idGeneratorFn,
        this.enableCacheDefault
      )
    }

    const existing = this.collections.get(name)
    if (existing) {
      return existing as Collection<T>
    }

    // Determine cache setting: collection option > database default
    const enableCache = options?.enableCache ?? this.enableCacheDefault

    const collection = new SQLiteCollection<T>(
      this.sqliteDb,
      name,
      schema,
      this.idGeneratorFn,
      enableCache,
      this.retryOptionsDefault,
      options?.retry
    )
    this.collections.set(name, collection as Collection<Document>)

    return collection
  }

  /**
   * Creates a new transaction.
   *
   * @returns Transaction instance
   */
  transaction(): Transaction {
    this.sqliteDb.exec("BEGIN TRANSACTION")

    let committed = false

    const tx: Transaction = {
      collection: <T extends Document>(
        name: string,
        schema: SchemaDefinition<T>
      ): Collection<T> => this.collection(name, schema),

      commit: () => {
        this.sqliteDb.exec("COMMIT")
        committed = true
      },

      rollback: () => {
        if (!committed) {
          this.sqliteDb.exec("ROLLBACK")
        }
      },

      [Symbol.dispose]: () => {
        if (!committed) {
          tx.rollback()
        }
      },
    }

    return tx
  }

  /**
   * Executes a function within a transaction.
   *
   * @param fn - Function to execute
   * @returns Result of the function
   */
  async execute<R>(
    fn: (tx: Transaction) => R | Promise<R>,
    options?: { signal?: AbortSignal }
  ): Promise<R> {
    throwIfAborted(options?.signal)

    const tx = this.transaction()
    try {
      const result = await fn(tx)
      tx.commit()
      return result
    } catch (error) {
      tx.rollback()
      throw error
    }
  }

  /**
   * Closes the database connection.
   */
  close(): void {
    // Clean up event listeners for all collections
    for (const collection of this.collections.values()) {
      collection.cleanupEvents()
    }

    this.onCloseCallback?.()
    this.sqliteDb.close()
  }

  /**
   * Disposes the database (closes connection).
   */
  [Symbol.dispose](): void {
    this.close()
  }
}
