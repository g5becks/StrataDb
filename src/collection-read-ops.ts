import type { SQLQueryBindings } from "bun:sqlite"
import { throwIfAborted } from "./abort-utils.js"
import type { StoredRow } from "./collection-core.js"
import { CollectionCore } from "./collection-core.js"
import type { Document } from "./core-types.js"
import {
  buildCursorPredicate,
  cursorOrder,
  reverseSort,
} from "./cursor-pagination.js"
import { assertDatabaseOpen } from "./database-state.js"
import { bind, positional, resolveField } from "./field-resolver.js"
import { inclusionSQL } from "./projection-sql.js"
import type {
  CursorSpec,
  ProjectionSpec,
  QueryOptions,
  QueryOptionsWithOmit,
  QueryOptionsWithSelect,
  SortSpec,
  TextSearchSpec,
} from "./query-options-types.js"
import type { QueryFilter } from "./query-types.js"
import type { RetryOptions } from "./retry-types.js"
import { escapeLikeLiteral } from "./string-patterns.js"
/** Collection read operations; public contracts are documented by Collection. */
export class CollectionReadOps<T extends Document> extends CollectionCore<T> {
  private normalizeProjection(
    options?: QueryOptions<T>
  ): ProjectionSpec<T> | undefined {
    if (!options) {
      return
    }

    // Precedence: projection > select > omit
    if (options.projection) {
      return options.projection
    }

    if (options.select) {
      const projection: Record<string, 1> = {}
      for (const field of options.select) {
        projection[field as string] = 1
      }
      return projection as ProjectionSpec<T>
    }

    if (options.omit) {
      const projection: Record<string, 0> = {}
      for (const field of options.omit) {
        projection[field as string] = 0
      }
      return projection as ProjectionSpec<T>
    }

    return undefined
  }

  private buildSearchClause(
    search: TextSearchSpec<T>
  ): { sql: string; params: SQLQueryBindings[] } | undefined {
    if (!search.text || search.fields.length === 0) {
      return
    }

    const pattern = `%${escapeLikeLiteral(search.text)}%`
    const clauses: string[] = []
    const params: SQLQueryBindings[] = []

    for (const field of search.fields) {
      const column = resolveField(String(field), this.schema.fields, params)
      clauses.push(
        search.caseSensitive
          ? `instr(${column}, ${bind(search.text, params)}) > 0`
          : `strata_casefold(${column}) LIKE strata_casefold(${bind(pattern, params)}) ESCAPE '\\'`
      )
    }

    return {
      ...positional(`(${clauses.join(" OR ")})`, params),
    }
  }

  private buildCursorClause(
    cursor: CursorSpec,
    sort: SortSpec<T>
  ): { sql: string; params: SQLQueryBindings[] } | undefined {
    return buildCursorPredicate({
      sql: this.sql,
      collection: this.name,
      schema: this.schema,
      cursor,
      sort,
    })
  }

  private applyProjection(
    docs: readonly T[],
    projection: ProjectionSpec<T>
  ): readonly T[] {
    const entries = Object.entries(projection)
    if (entries.length === 0) {
      return docs
    }

    // Detect mode: if any value is 1, it's include mode; otherwise exclude mode
    const isIncludeMode = entries.some(([, value]) => value === 1)

    if (isIncludeMode) {
      return this.applyIncludeProjection(docs, entries, projection)
    }
    return this.applyExcludeProjection(docs, projection)
  }

  private applyIncludeProjection(
    docs: readonly T[],
    entries: [string, 1 | 0 | undefined][],
    projection: ProjectionSpec<T>
  ): readonly T[] {
    return docs.map((doc) => {
      // Start with _id unless explicitly excluded
      const result: Record<string, unknown> =
        projection._id === 0 ? {} : { _id: doc._id }

      for (const [field, value] of entries) {
        if (value === 1 && field in doc) {
          result[field] = doc[field as keyof T]
        }
      }
      return result as T
    })
  }

  private applyExcludeProjection(
    docs: readonly T[],
    projection: ProjectionSpec<T>
  ): readonly T[] {
    return docs.map((doc) => {
      const result: Record<string, unknown> = {}
      for (const key of Object.keys(doc)) {
        const projectionValue = projection[key as keyof T]
        if (projectionValue !== 0) {
          result[key] = doc[key as keyof T]
        }
      }
      return result as T
    })
  }

  findById(
    id: string,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<T | null> {
    return this.runOperation(
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        const stmt = this.sql.prepare<StoredRow, [string]>(
          `SELECT _id, json(body) as body, createdAt, updatedAt FROM ${this.tableSql} WHERE _id = ?`
        )
        const row = stmt.get(id)

        if (!row) {
          return Promise.resolve(null)
        }

        return Promise.resolve(this.hydrate(row))
      },
      this.buildRetryOptions(options?.retry, options?.signal),
      "findById"
    )
  }

  find<K extends keyof T>(
    filter: QueryFilter<T>,
    options: QueryOptionsWithSelect<T, K>
  ): Promise<readonly Pick<T, K | (keyof T & "_id")>[]>

  find<K extends keyof T>(
    filter: QueryFilter<T>,
    options: QueryOptionsWithOmit<T, K>
  ): Promise<readonly Omit<T, K>[]>

  find(filter: QueryFilter<T>, options?: QueryOptions<T>): Promise<readonly T[]>

  find(
    filter: QueryFilter<T>,
    options?: QueryOptions<T>
  ): Promise<readonly T[]> {
    return this.runOperation(
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        const { sql: whereClause, params } = this.translator.translate(filter)

        const cursorPlan = cursorOrder(options?.sort, options?.cursor)

        const projection = this.normalizeProjection(options)
        const inclusion = inclusionSQL(
          projection,
          this.schema.timestamps !== false
        )
        let sql = `SELECT _id, ${inclusion?.sql ?? "json(body)"} as body, createdAt, updatedAt FROM ${this.tableSql}`

        // Build WHERE clause combining filter and search
        const whereParts: string[] = []
        const allParams: SQLQueryBindings[] = [
          ...(inclusion?.params ?? []),
          ...params,
        ]

        if (whereClause) {
          whereParts.push(whereClause)
        }

        for (const fragment of this.extraFilters(options, cursorPlan.sort)) {
          whereParts.push(fragment.sql)
          allParams.push(...fragment.params)
        }

        if (whereParts.length > 0) {
          sql += ` WHERE ${whereParts.join(" AND ")}`
        }

        const translatedOptions = this.orderedOptions(options, cursorPlan)
        if (translatedOptions.sql) {
          sql += ` ${translatedOptions.sql}`
          allParams.push(...translatedOptions.params)
        }

        const stmt = this.sql.prepare<StoredRow, SQLQueryBindings[]>(sql)
        const rows = stmt.all(...allParams)

        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        let results = (cursorPlan.reverse ? rows.reverse() : rows).map((row) =>
          inclusion ? (JSON.parse(row.body) as T) : this.hydrate(row)
        )

        // Apply projection (select/omit/projection)
        if (projection && !inclusion) {
          results = this.applyProjection(results, projection) as T[]
        }

        return Promise.resolve(results)
      },
      this.buildRetryOptions(options?.retry, options?.signal),
      "find"
    )
  }

  findOne<K extends keyof T>(
    filter: string | QueryFilter<T>,
    options: Omit<QueryOptionsWithSelect<T, K>, "limit" | "skip">
  ): Promise<Pick<T, K | (keyof T & "_id")> | null>

  findOne<K extends keyof T>(
    filter: string | QueryFilter<T>,
    options: Omit<QueryOptionsWithOmit<T, K>, "limit" | "skip">
  ): Promise<Omit<T, K> | null>

  findOne(
    filter: string | QueryFilter<T>,
    options?: Omit<QueryOptions<T>, "limit" | "skip">
  ): Promise<T | null>

  async findOne(
    filter: string | QueryFilter<T>,
    options?: Omit<QueryOptions<T>, "limit" | "skip">
  ): Promise<T | null> {
    const normalizedFilter = this.normalizeFilter(filter)
    if (
      !options ||
      Object.keys(options).every((key) => key === "signal" || key === "retry")
    ) {
      return await this.runOperation(
        () => {
          throwIfAborted(options?.signal)
          const document = this.readOneSync(normalizedFilter)
          return Promise.resolve(
            document ? this.visibleDocument(document) : null
          )
        },
        this.buildRetryOptions(options?.retry, options?.signal),
        "findOne"
      )
    }
    const results = await this.find(normalizedFilter, { ...options, limit: 1 })
    return results[0] ?? null
  }

  count(
    filter: QueryFilter<T>,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<number> {
    return this.runOperation(
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        const { sql: whereClause, params } = this.translator.translate(filter)

        let sql = `SELECT COUNT(*) as count FROM ${this.tableSql}`
        if (whereClause) {
          sql += ` WHERE ${whereClause}`
        }

        const stmt = this.sql.prepare<{ count: number }, SQLQueryBindings[]>(
          sql
        )
        const row = stmt.get(...params)
        return Promise.resolve(row?.count ?? 0)
      },
      this.buildRetryOptions(options?.retry, options?.signal),
      "count"
    )
  }

  search<K extends keyof T>(
    text: string,
    fields: readonly (keyof T | string)[],
    options: Omit<QueryOptionsWithSelect<T, K>, "search"> & {
      filter?: QueryFilter<T>
      caseSensitive?: boolean
    }
  ): Promise<readonly Pick<T, K | (keyof T & "_id")>[]>

  search<K extends keyof T>(
    text: string,
    fields: readonly (keyof T | string)[],
    options: Omit<QueryOptionsWithOmit<T, K>, "search"> & {
      filter?: QueryFilter<T>
      caseSensitive?: boolean
    }
  ): Promise<readonly Omit<T, K>[]>

  search(
    text: string,
    fields: readonly (keyof T | string)[],
    options?: Omit<QueryOptions<T>, "search"> & {
      filter?: QueryFilter<T>
      caseSensitive?: boolean
    }
  ): Promise<readonly T[]>

  search(
    text: string,
    fields: readonly (keyof T | string)[],
    options?: Omit<QueryOptions<T>, "search"> & {
      filter?: QueryFilter<T>
      caseSensitive?: boolean
    }
  ): Promise<readonly T[]> {
    // Delegate to find() with the search option
    const filter = options?.filter ?? ({} as QueryFilter<T>)
    const { filter: _, caseSensitive, ...restOptions } = options ?? {}

    const searchSpec: {
      text: string
      fields: readonly (keyof T | string)[]
    } & {
      caseSensitive?: boolean
    } = { text, fields }

    if (caseSensitive !== undefined) {
      searchSpec.caseSensitive = caseSensitive
    }

    return this.find(filter, {
      ...restOptions,
      search: searchSpec,
    })
  }

  distinct<K extends keyof Omit<T, "_id" | "createdAt" | "updatedAt">>(
    field: K,
    filter?: QueryFilter<T>,
    options?: { signal?: AbortSignal; retry?: RetryOptions | false }
  ): Promise<T[K][]> {
    return this.runOperation(
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        const columnParams: SQLQueryBindings[] = []
        const column = resolveField(
          String(field),
          this.schema.fields,
          columnParams
        )
        const selection = positional(
          `SELECT DISTINCT ${column} as value FROM ${this.tableSql}`,
          columnParams
        )
        let { sql } = selection
        const params: SQLQueryBindings[] = [...selection.params]

        if (filter) {
          const { sql: whereClause, params: filterParams } =
            this.translator.translate(filter)
          if (whereClause) {
            sql += ` WHERE ${whereClause}`
            params.push(...filterParams)
          }
        }

        sql += " ORDER BY value"

        const stmt = this.sql.prepare<{ value: T[K] }, SQLQueryBindings[]>(sql)
        const rows = stmt.all(...params)

        return Promise.resolve(rows.map((row) => row.value))
      },
      this.buildRetryOptions(options?.retry, options?.signal),
      "distinct"
    )
  }

  estimatedDocumentCount(options?: {
    signal?: AbortSignal
    retry?: RetryOptions | false
  }): Promise<number> {
    return this.runOperation(
      () => {
        assertDatabaseOpen(this.db)
        throwIfAborted(options?.signal)

        // Use SQLite's internal statistics for fast estimate
        const stmt = this.sql.prepare<{ count: number }, []>(
          `SELECT COUNT(*) as count FROM ${this.tableSql}`
        )
        const result = stmt.get()
        return Promise.resolve(result?.count ?? 0)
      },
      this.buildRetryOptions(options?.retry, options?.signal),
      "estimatedDocumentCount"
    )
  }

  private extraFilters(
    options: QueryOptions<T> | undefined,
    sort: SortSpec<T> | undefined
  ): { sql: string; params: SQLQueryBindings[] }[] {
    const fragments: { sql: string; params: SQLQueryBindings[] }[] = []
    const search = options?.search
      ? this.buildSearchClause(options.search)
      : undefined
    const cursor =
      options?.cursor && sort
        ? this.buildCursorClause(options.cursor, sort)
        : undefined
    if (search) {
      fragments.push(search)
    }
    if (cursor) {
      fragments.push(cursor)
    }
    return fragments
  }
  private orderedOptions(
    options: QueryOptions<T> | undefined,
    cursorPlan: ReturnType<typeof cursorOrder<T>>
  ): { sql: string; params: SQLQueryBindings[] } {
    return this.translator.translateOptions({
      ...options,
      ...(cursorPlan.sort
        ? {
            sort: cursorPlan.reverse
              ? reverseSort(cursorPlan.sort)
              : cursorPlan.sort,
          }
        : {}),
    })
  }
}
