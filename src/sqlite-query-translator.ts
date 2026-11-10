import type { Document } from "./core-types.js"
import { QueryError } from "./errors.js"
import { assertNonNegativeInt, bind, positional } from "./field-resolver.js"
import { QueryOperators } from "./query-operators.js"
import type { QueryOptions } from "./query-options-types.js"
import {
  createQueryResult,
  type QueryTranslator,
  type QueryTranslatorResult,
  type SQLiteBindValue,
} from "./query-translator-types.js"
/** SQLite filter translation with shape caching and ordered query options. */
export class SQLiteQueryTranslator<T extends Document>
  extends QueryOperators<T>
  implements QueryTranslator<T>
{
  translateOptions(options: QueryOptions<T>): QueryTranslatorResult {
    const params: SQLiteBindValue[] = []
    const clauses: string[] = []

    // Handle sort (ORDER BY clause)
    if (options.sort) {
      const orderBy = this.translateSort(options.sort, params)
      if (orderBy) {
        clauses.push(orderBy)
      }
    }

    // Handle limit (LIMIT clause)
    if (options.limit !== undefined) {
      assertNonNegativeInt(options.limit, "limit")
      clauses.push(`LIMIT ${bind(options.limit, params)}`)
    }

    // Handle skip (OFFSET clause)
    if (options.skip !== undefined) {
      assertNonNegativeInt(options.skip, "skip")
      if (options.limit === undefined) {
        clauses.push("LIMIT -1")
      }
      clauses.push(`OFFSET ${bind(options.skip, params)}`)
    }

    // Note: projection is handled by the collection layer during SELECT construction

    const result = positional(clauses.join(" "), params)
    return createQueryResult(result.sql, result.params)
  }

  protected translateSort(
    sort: QueryOptions<T>["sort"],
    params: SQLiteBindValue[]
  ): string {
    if (!sort) {
      return ""
    }

    const sortFields: string[] = []

    for (const [fieldName, direction] of Object.entries(sort)) {
      if (direction !== 1 && direction !== -1) {
        throw new QueryError("Sort direction must be 1 or -1")
      }
      const fieldSql = this.resolveFieldName(fieldName as keyof T, params)
      const dir = direction === 1 ? "ASC" : "DESC"
      sortFields.push(
        `${fieldSql} ${dir} NULLS ${direction === 1 ? "FIRST" : "LAST"}`
      )
    }

    return sortFields.length > 0 ? `ORDER BY ${sortFields.join(", ")}` : ""
  }
}
