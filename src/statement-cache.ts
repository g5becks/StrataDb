import type { Database, SQLQueryBindings, Statement } from "bun:sqlite"
import { SchemaValidationError } from "./errors.js"

export type NativeStatement = Statement<unknown, SQLQueryBindings[]>
export type CachedStatement = {
  native: NativeStatement
  wrapped: NativeStatement
}
const connections = new WeakMap<Database, Set<StatementCache>>()

export function validateStatementCacheSize(size: number): number {
  if (!Number.isSafeInteger(size) || size < 1) {
    throw new SchemaValidationError(
      "statementCacheSize must be a positive safe integer"
    )
  }
  return size
}

/** Each collection owns one bounded LRU; the registry only coordinates lifecycle. */
export class StatementCache {
  private readonly entries = new Map<string, CachedStatement>()
  private readonly database: Database
  private readonly capacity: number
  private readonly create: (sql: string) => CachedStatement
  private registered = false

  constructor(
    database: Database,
    capacity: number,
    create: (sql: string) => CachedStatement
  ) {
    this.database = database
    this.capacity = validateStatementCacheSize(capacity)
    this.create = create
    this.register()
  }

  private register(): void {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: register and dispose mutate this flag across calls
    if (this.registered) {
      return
    }
    let caches = connections.get(this.database)
    if (!caches) {
      caches = new Set()
      connections.set(this.database, caches)
    }
    caches.add(this)
    this.registered = true
  }

  get(sql: string): CachedStatement {
    this.register()
    const existing = this.entries.get(sql)
    if (existing && !existing.native.isFinalized) {
      this.entries.delete(sql)
      this.entries.set(sql, existing)
      return existing
    }
    this.entries.delete(sql)
    if (this.entries.size >= this.capacity) {
      const oldest = this.entries.keys().next().value
      if (oldest !== undefined) {
        const entry = this.entries.get(oldest)
        if (entry && !entry.native.isFinalized) {
          entry.native.finalize()
        }
        this.entries.delete(oldest)
      }
    }
    const entry = this.create(sql)
    this.entries.set(sql, entry)
    return entry
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      if (!entry.native.isFinalized) {
        entry.native.finalize()
      }
    }
    this.entries.clear()
  }

  dispose(): void {
    this.clear()
    connections.get(this.database)?.delete(this)
    this.registered = false
  }
}

export function clearStatementCaches(database: Database): void {
  for (const cache of connections.get(database) ?? []) {
    cache.clear()
  }
}

export function disposeStatementCaches(database: Database): void {
  for (const cache of [...(connections.get(database) ?? [])]) {
    cache.dispose()
  }
  connections.delete(database)
}
