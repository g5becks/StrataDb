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

export const sqliteOperation: AsyncLocalStorage<string> =
  new AsyncLocalStorage<string>()
const UNIQUE_FIELD = /UNIQUE constraint failed: .+\.(_?[A-Za-z_][A-Za-z0-9_]*)/

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

  constructor(database: Database, collection: string) {
    this.database = database
    this.collection = collection
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
    const context = this.context(sql)
    const statement = sqliteCall(
      () => this.database.prepare<Row, Params>(sql),
      context
    )
    return new Proxy(statement, {
      get(target, key) {
        const value: unknown = Reflect.get(target, key, target)
        if (typeof value !== "function") {
          return value
        }
        return (...args: unknown[]) =>
          sqliteCall(() => Reflect.apply(value, target, args), context)
      },
    }) as Statement<Row, Params>
  }

  run(sql: string): void {
    sqliteCall(() => this.database.run(sql), this.context(sql))
  }
  exec(sql: string): void {
    sqliteCall(() => this.database.exec(sql), this.context(sql))
  }
}
