import type { Document } from "./core-types.js"
import { InvalidQueryOperatorError } from "./errors.js"
import {
  arrayElement,
  arrayElementPresence,
  bind,
  resolveField,
  resolvePresence,
} from "./field-resolver.js"
import { QueryTranslationCache } from "./query-translation-cache.js"
import type { SQLiteBindValue } from "./query-translator-types.js"
import type { QueryFilter } from "./query-types.js"
import { likeToGlob } from "./string-patterns.js"
/** Validated field, logical and array SQL translation. */
export class QueryOperators<
  T extends Document,
> extends QueryTranslationCache<T> {
  protected translateFilter(
    filter: QueryFilter<T>,
    params: SQLiteBindValue[],
    root?: string
  ): string {
    const conditions: string[] = []

    for (const [key, value] of Object.entries(filter)) {
      const condition = this.translateFilterEntry(key, value, params, root)
      if (condition) {
        conditions.push(condition)
      }
    }

    return conditions.length > 0 ? conditions.join(" AND ") : "1=1"
  }

  protected translateFilterEntry(
    key: string,
    value: unknown,
    params: SQLiteBindValue[],
    root?: string
  ): string | null {
    // Handle logical operators
    if (key === "$and") {
      const filters = value as readonly QueryFilter<T>[]
      if (filters.length === 0) {
        return "1=1" // Empty $and matches everything (vacuous truth)
      }
      const andConditions = filters.map((f) =>
        this.translateFilter(f, params, root)
      )
      return `(${andConditions.join(" AND ")})`
    }

    if (key === "$or") {
      const filters = value as readonly QueryFilter<T>[]
      if (filters.length === 0) {
        return "0=1" // No branch can match an empty OR.
      }
      const orConditions = filters.map((f) =>
        this.translateFilter(f, params, root)
      )
      return `(${orConditions.join(" OR ")})`
    }

    if (key === "$nor") {
      const filters = value as readonly QueryFilter<T>[]
      if (filters.length === 0) {
        return "1=1" // Empty $nor matches everything
      }
      const norConditions = filters.map((f) =>
        this.translateFilter(f, params, root)
      )
      return `NOT COALESCE((${norConditions.join(" OR ")}), 0)`
    }

    if (key === "$not") {
      const notCondition = this.translateFilter(
        value as QueryFilter<T>,
        params,
        root
      )
      return `NOT COALESCE((${notCondition}), 0)`
    }

    // Handle field conditions
    return this.translateFieldCondition(key as keyof T, value, params, root)
  }

  protected translateFieldCondition(
    fieldName: keyof T,
    value: unknown,
    params: SQLiteBindValue[],
    root?: string
  ): string | null {
    const fieldSql = this.resolveFieldName(fieldName, params, root)
    if (value === null) {
      return `${fieldSql} IS NULL`
    }

    // Direct value comparison (e.g., { name: 'Alice' })
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return `${fieldSql} = ${bind(this.toBindValue(value), params)}`
    }

    // Operator conditions (e.g., { age: { $gt: 18 } })
    if (typeof value === "object" && value !== null) {
      const operatorSql = this.translateFieldOperators(
        fieldSql,
        value as Record<string, unknown>,
        params,
        "$exists" in value || "$elemMatch" in value || "$index" in value
          ? resolvePresence(String(fieldName), params, root)
          : undefined
      )
      return operatorSql || null
    }

    return null
  }

  protected translateFieldOperators(
    fieldSql: string,
    operators: Record<string, unknown>,
    params: SQLiteBindValue[],
    presenceSql?: string | undefined
  ): string {
    const conditions: string[] = []

    for (const [op, value] of Object.entries(operators)) {
      const condition = this.translateSingleOperator({
        fieldSql,
        op,
        value,
        operators,
        params,
        presenceSql,
      })
      if (condition) {
        conditions.push(condition)
      }
    }

    return conditions.length > 0 ? `(${conditions.join(" AND ")})` : ""
  }

  protected translateSingleOperator(context: {
    fieldSql: string
    op: string
    value: unknown
    operators: Record<string, unknown>
    params: SQLiteBindValue[]
    presenceSql?: string | undefined
  }): string | null {
    const { fieldSql, op, value, params } = context
    switch (op) {
      case "$regex":
        return `strata_regexp(${bind(value as string, params)}, ${fieldSql}) = 1`
      case "$eq":
        return value === null
          ? `${fieldSql} IS NULL`
          : `${fieldSql} = ${bind(this.toBindValue(value), params)}`

      case "$ne":
        return value === null
          ? `${fieldSql} IS NOT NULL`
          : `(${fieldSql} IS NULL OR ${fieldSql} != ${bind(this.toBindValue(value), params)})`

      case "$gt":
        return `${fieldSql} > ${bind(this.toBindValue(value), params)}`

      case "$gte":
        return `${fieldSql} >= ${bind(this.toBindValue(value), params)}`

      case "$lt":
        return `${fieldSql} < ${bind(this.toBindValue(value), params)}`

      case "$lte":
        return `${fieldSql} <= ${bind(this.toBindValue(value), params)}`

      case "$in":
        return this.translateInOperator(fieldSql, value, params)

      case "$nin":
        return this.translateNotInOperator(fieldSql, value, params)

      case "$like":
        return `${fieldSql} GLOB ${bind(likeToGlob(value as string), params)}`
      case "$ilike":
        return `lower(${fieldSql}) LIKE lower(${bind(this.toBindValue(value), params)}) ESCAPE '\\'`
      case "$contains":
      case "$startsWith":
      case "$endsWith":
        return this.translateLiteralString(
          fieldSql,
          op,
          value as string,
          params
        )

      case "$all":
        return this.translateAllOperator(fieldSql, value, params)

      case "$size":
        return this.translateSizeOperator(fieldSql, value, params)

      case "$elemMatch":
        return this.translateElemMatchOperator(
          fieldSql,
          value,
          params,
          context.presenceSql
        )

      case "$index":
        return this.translateIndexOperator(
          fieldSql,
          value,
          params,
          context.presenceSql
        )

      case "$exists":
        return this.translateExistsOperator(
          context.presenceSql ?? `json_type(${fieldSql})`,
          value
        )

      // Additional operators will be added in subsequent tasks

      default:
        if (op.startsWith("$")) {
          throw new InvalidQueryOperatorError(`Unknown query operator ${op}`)
        }
        // Object-element field translation is handled by TASK-245.
        return null
    }
  }

  protected translateLiteralString(
    fieldSql: string,
    operator: "$contains" | "$startsWith" | "$endsWith",
    value: string,
    params: SQLiteBindValue[]
  ): string {
    if (operator === "$contains") {
      return `instr(${fieldSql}, ${bind(value, params)}) > 0`
    }
    if (operator === "$startsWith") {
      return `substr(${fieldSql}, 1, length(${bind(value, params)})) = ${bind(value, params)}`
    }
    if (value.length === 0) {
      return `${fieldSql} IS NOT NULL`
    }
    return `substr(${fieldSql}, -length(${bind(value, params)})) = ${bind(value, params)}`
  }

  protected translateInOperator(
    fieldSql: string,
    values: unknown,
    params: SQLiteBindValue[]
  ): string {
    const valuesArray = values as readonly unknown[]
    if (valuesArray.length === 0) {
      // Empty IN clause matches nothing
      return "0=1"
    }

    const nonNullValues = valuesArray.filter((value) => value !== null)
    if (!nonNullValues.length) {
      return `${fieldSql} IS NULL`
    }
    const placeholders = nonNullValues
      .map((value) => bind(this.toBindValue(value), params))
      .join(", ")
    const membership = `${fieldSql} IN (${placeholders})`
    return valuesArray.includes(null)
      ? `(${fieldSql} IS NULL OR ${membership})`
      : membership
  }

  protected translateNotInOperator(
    fieldSql: string,
    values: unknown,
    params: SQLiteBindValue[]
  ): string {
    const valuesArray = values as readonly unknown[]
    if (valuesArray.length === 0) {
      // Empty NOT IN clause matches everything
      return "1=1"
    }

    const nonNullValues = valuesArray.filter((value) => value !== null)
    if (nonNullValues.length === 0) {
      return `${fieldSql} IS NOT NULL`
    }
    const placeholders = nonNullValues
      .map((value) => bind(this.toBindValue(value), params))
      .join(", ")
    const exclusion = `${fieldSql} NOT IN (${placeholders})`
    return valuesArray.includes(null)
      ? `(${fieldSql} IS NOT NULL AND ${exclusion})`
      : `(${fieldSql} IS NULL OR ${exclusion})`
  }

  protected resolveFieldName(
    fieldName: keyof T,
    params: SQLiteBindValue[],
    root?: string
  ): string {
    return resolveField(
      String(fieldName),
      [...this.fieldMap.values()],
      params,
      root
    )
  }

  protected translateAllOperator(
    fieldSql: string,
    values: unknown,
    params: SQLiteBindValue[]
  ): string {
    const valuesArray = values as readonly unknown[]
    if (valuesArray.length === 0) {
      // Empty $all matches everything (vacuous truth)
      return "1=1"
    }

    const conditions: string[] = []
    for (const v of valuesArray) {
      // Check if value exists in the array using json_each
      conditions.push(
        `EXISTS (SELECT 1 FROM json_each(${fieldSql}) WHERE ${v === null ? "json_each.type = 'null'" : `json_each.value = ${bind(this.toBindValue(v), params)}`})`
      )
    }

    return `(${conditions.join(" AND ")})`
  }

  protected translateSizeOperator(
    fieldSql: string,
    size: unknown,
    params: SQLiteBindValue[]
  ): string {
    return `json_array_length(${fieldSql}) = ${bind(this.toBindValue(size), params)}`
  }

  protected translateElemMatchOperator(
    fieldSql: string,
    elementFilter: unknown,
    params: SQLiteBindValue[],
    fieldTypeSql?: string
  ): string {
    // Extract the nested filter conditions
    const filter = elementFilter as Record<string, unknown>
    const conditions: string[] = []
    const alias = `strata_elem_${this.elementAlias}`
    this.elementAlias += 1
    const root = `CASE WHEN ${alias}.type = 'object' THEN ${alias}.value END`
    let objectFilter = false
    for (const [op, value] of Object.entries(filter)) {
      const objectEntry =
        !op.startsWith("$") || ["$and", "$or", "$nor", "$not"].includes(op)
      objectFilter ||= objectEntry
      const condition = objectEntry
        ? this.translateFilterEntry(op, value, params, root)
        : this.translateSingleOperator({
            fieldSql: `${alias}.value`,
            presenceSql: `${alias}.type`,
            op,
            value,
            operators: filter,
            params,
          })
      if (condition) {
        conditions.push(condition)
      }
    }

    const whereClause = `${objectFilter ? `${alias}.type = 'object' AND ` : ""}${conditions.join(" AND ")}`
    const array = `CASE WHEN ${fieldTypeSql ?? `json_type(${fieldSql})`} = 'array' THEN ${fieldSql} END`
    return `EXISTS (SELECT 1 FROM json_each(${array}) AS ${alias} WHERE ${whereClause})`
  }

  protected translateIndexOperator(
    fieldSql: string,
    indexFilter: unknown,
    params: SQLiteBindValue[],
    fieldTypeSql?: string
  ): string {
    const filter = indexFilter as { index: number; condition: unknown }
    const array = `CASE WHEN ${fieldTypeSql ?? `json_type(${fieldSql})`} = 'array' THEN ${fieldSql} END`
    const element = arrayElement(array, filter.index, params)
    const presence = arrayElementPresence(array, filter.index, params)
    let condition: string
    if (this.isOperatorObject(filter.condition)) {
      condition = this.translateFieldOperators(
        element,
        filter.condition as Record<string, unknown>,
        params,
        presence
      )
    } else {
      condition =
        filter.condition === null
          ? `${element} IS NULL`
          : `${element} = ${bind(this.toBindValue(filter.condition), params)}`
    }
    return `(${presence} IS NOT NULL AND ${condition})`
  }

  protected translateExistsOperator(
    presenceSql: string,
    shouldExist: unknown
  ): string {
    if (shouldExist === true) {
      // Field exists if json_type is not NULL
      return `${presenceSql} IS NOT NULL`
    }
    // Field doesn't exist if json_type is NULL
    return `${presenceSql} IS NULL`
  }
}
