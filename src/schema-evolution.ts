import type { Database } from "bun:sqlite"
import type { Document } from "./core-types.js"
import { SchemaValidationError } from "./errors.js"
import {
  compoundIndexName,
  ddlField,
  generatedColumn,
  quoteIdent,
} from "./field-resolver.js"
import type { SchemaDefinition, SQLiteType } from "./schema-types.js"
import type { SQLiteBoundary } from "./sqlite-boundary.js"

/** A stored generated column removed from or changed by the requested schema. */
export type SchemaDrift = {
  readonly collection: string
  readonly column: string
  readonly kind: "removed" | "type-changed"
  readonly storedType: string
  readonly expectedType?: string
}

/** Receive schema drift, or reject opening a collection with any drift. */
export type SchemaDriftHandler = ((change: SchemaDrift) => void) | "error"

const handlers = new WeakMap<Database, SchemaDriftHandler>()

export function configureSchemaDrift(
  database: Database,
  handler: SchemaDriftHandler | undefined
): void {
  if (handler === undefined) {
    handlers.delete(database)
  } else {
    handlers.set(database, handler)
  }
}

function storedType(type: SQLiteType): string {
  return type === "BOOLEAN" ? "INTEGER" : type
}

function reportDrift(database: Database, change: SchemaDrift): void {
  const handler = handlers.get(database)
  if (handler === "error") {
    throw new SchemaValidationError(
      `Schema drift in ${change.collection}.${change.column}: ${change.kind}`
    )
  }
  if (handler) {
    handler(change)
  } else {
    console.warn("StrataDB schema drift (stored column retained):", change)
  }
}

function dropStaleIndexes<T extends Document>(
  sql: SQLiteBoundary,
  collection: string,
  schema: SchemaDefinition<T>,
  missingFields: Set<string>
): void {
  // Older versions could create indexes on a quoted missing column as a
  // constant expression. ALTER TABLE alone leaves their entries invalid.
  for (const name of missingFields) {
    sql.run(`DROP INDEX IF EXISTS ${quoteIdent(`idx_${collection}_${name}`)}`)
  }
  for (const index of schema.compoundIndexes ?? []) {
    if (index.fields.some((field) => missingFields.has(String(field)))) {
      sql.run(
        `DROP INDEX IF EXISTS ${compoundIndexName(collection, index.name)}`
      )
    }
  }
}

/** Called inside the collection's atomic DDL transaction. */
export function evolveGeneratedColumns<T extends Document>(context: {
  database: Database
  sql: SQLiteBoundary
  collection: string
  schema: SchemaDefinition<T>
}): void {
  const { database, sql, collection, schema } = context
  const columns = sql
    .prepare<{ name: string; type: string; hidden: number }, []>(
      `PRAGMA table_xinfo(${quoteIdent(collection)})`
    )
    .all()
  const indexed = schema.fields.filter((field) => field.indexed)
  const expected = new Map(
    indexed.map((field) => [
      generatedColumn(String(field.name)).slice(1, -1),
      field,
    ])
  )
  for (const column of columns.filter((entry) => entry.hidden >= 2)) {
    const field = expected.get(column.name)
    const expectedType = field ? storedType(field.type) : undefined
    if (!field || column.type.toUpperCase() !== expectedType) {
      const change: SchemaDrift = {
        collection,
        column: column.name,
        kind: field ? "type-changed" : "removed",
        storedType: column.type,
        ...(expectedType === undefined ? {} : { expectedType }),
      }
      reportDrift(database, change)
    }
  }
  const existing = new Set(columns.map((column) => column.name))
  const missingFields = new Set(
    [...expected]
      .filter(([column]) => !existing.has(column))
      .map(([, field]) => String(field.name))
  )
  dropStaleIndexes(sql, collection, schema, missingFields)
  for (const [column, field] of expected) {
    if (!existing.has(column)) {
      sql.run(
        `ALTER TABLE ${quoteIdent(collection)} ADD COLUMN ${quoteIdent(column)} ${storedType(field.type)} GENERATED ALWAYS AS (${ddlField(String(field.name))}) VIRTUAL`
      )
    }
  }
}
