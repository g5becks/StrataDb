import {
  type Database,
  SQLiteError,
  type SQLQueryBindings,
  type Statement,
} from "bun:sqlite"
import { AsyncLocalStorage } from "node:async_hooks"
import {
  ConnectionError,
  ConstraintError,
  DatabaseError,
  QueryError,
  type SQLiteErrorContext,
  StrataDBError,
  UniqueConstraintError,
} from "./errors.js"
import {
  clearStatementCaches,
  type NativeStatement,
  StatementCache,
} from "./statement-cache.js"

export const sqliteOperation: AsyncLocalStorage<string> =
  new AsyncLocalStorage<string>()
const UNIQUE_FIELD = /UNIQUE constraint failed: .+\.(_?[A-Za-z_][A-Za-z0-9_]*)/
const DDL = /^\s*(CREATE|ALTER|DROP|REINDEX|VACUUM)\b/i

/** Preserve library errors and classify native SQLite errors only by errno. */
export function wrapSqliteError(
  error: unknown,
  context: SQLiteErrorContext = {}
): unknown {
  if (error instanceof StrataDBError || !(error instanceof SQLiteError)) {
    return error
  }
  const errno = error.errno
  const primary = errno % 256
  let wrapped: StrataDBError
  if (primary === 5 || primary === 6 || primary === 14) {
    wrapped = new ConnectionError(error.message, errno)
  } else if (errno === 2067 || errno === 1555) {
    const column = UNIQUE_FIELD.exec(error.message)?.[1]
    const field = column === "_id" ? column : column?.replace("_", "")
    wrapped = new UniqueConstraintError(error.message, field, undefined, errno)
  } else if (primary === 19) {
    wrapped = new ConstraintError(error.message, error.code, errno)
  } else if (primary === 1) {
    wrapped = new QueryError(error.message, context.sql)
  } else {
    wrapped = new DatabaseError(error.message, errno)
  }
  return Object.assign(wrapped, {
    errno,
    sqliteCodeName: error.code,
    context,
    cause: error,
  })
}

export function sqliteCall<R>(
  operation: () => R,
  context: SQLiteErrorContext
): R {
  try {
    return operation()
  } catch (error) {
    throw wrapSqliteError(error, context)
  }
}

/** Wrap native statements without changing their SQL, bindings or lifecycle. */
export class SQLiteBoundary {
  private readonly database: Database
  private readonly collection: string
  private readonly cache: StatementCache

  constructor(database: Database, collection: string, capacity = 64) {
    this.database = database
    this.collection = collection
    this.cache = new StatementCache(database, capacity, (sql) => {
      let native: NativeStatement
      try {
        native = this.database.prepare(sql)
      } catch (error) {
        throw wrapSqliteError(error, this.context(sql))
      }
      return { native, wrapped: this.wrap(native, sql) }
    })
  }

  private context(sql: string): SQLiteErrorContext {
    return {
      sql,
      collection: this.collection,
      operation: sqliteOperation.getStore() ?? "collection",
    }
  }

  prepare<Row, Params extends SQLQueryBindings[]>(
    sql: string
  ): Statement<Row, Params> {
    return this.cache.get(sql).wrapped as Statement<Row, Params>
  }

  private wrap(statement: NativeStatement, sql: string): NativeStatement {
    const methods = new Map<PropertyKey, (...args: unknown[]) => unknown>()
    const owner = this
    return new Proxy(statement, {
      get(target, key) {
        const method = methods.get(key)
        if (method) {
          return method
        }
        const current =
          target.isFinalized && key !== "isFinalized" && key !== "finalize"
            ? owner.cache.get(sql).native
            : target
        const value: unknown = Reflect.get(current, key, current)
        if (typeof value !== "function") {
          return value
        }
        const wrapped = (...args: unknown[]) => {
          const active =
            target.isFinalized && key !== "finalize"
              ? owner.cache.get(sql).native
              : target
          const fn =
            active === current ? value : Reflect.get(active, key, active)
          try {
            return Reflect.apply(fn, active, args)
          } catch (error) {
            throw wrapSqliteError(error, owner.context(sql))
          }
        }
        methods.set(key, wrapped)
        return wrapped
      },
    })
  }

  dispose(): void {
    this.cache.dispose()
  }

  private invalidateDDL(sql: string): void {
    if (DDL.test(sql)) {
      clearStatementCaches(this.database)
      this.database.clearQueryCache()
    }
  }

  run(sql: string): void {
    this.invalidateDDL(sql)
    sqliteCall(() => this.database.run(sql), this.context(sql))
  }
  exec(sql: string): void {
    this.invalidateDDL(sql)
    sqliteCall(() => this.database.exec(sql), this.context(sql))
  }
}
