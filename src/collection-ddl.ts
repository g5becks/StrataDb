import type { Database as SQLiteDatabase } from "bun:sqlite"
import type { Document } from "./core-types.js"
import { SchemaValidationError } from "./errors.js"
import {
  compoundIndexName,
  ddlField,
  fieldPath,
  generatedColumn,
  quoteIdent,
  resolveDDLField,
} from "./field-resolver.js"
import { evolveGeneratedColumns } from "./schema-evolution.js"
import type { SchemaDefinition } from "./schema-types.js"
import type { SQLiteBoundary } from "./sqlite-boundary.js"

type DDLContext<T extends Document> = {
  db: SQLiteDatabase
  sql: SQLiteBoundary
  name: string
  schema: SchemaDefinition<T>
  tableSql: string
}
export function createTable<T extends Document>(ctx: DDLContext<T>): void {
  quoteIdent(ctx.name)
  for (const field of ctx.schema.fields) {
    fieldPath(String(field.name))
  }
  const columns: string[] = [
    "_id TEXT PRIMARY KEY",
    "body BLOB NOT NULL",
    "createdAt INTEGER NOT NULL",
    "updatedAt INTEGER NOT NULL",
  ]

  // Add generated columns for indexed fields
  for (const field of ctx.schema.fields) {
    if (field.indexed) {
      const columnName = generatedColumn(String(field.name))
      const sqlType = mapTypeToSQLite(field.type)
      const expression = ddlField(String(field.name))
      columns.push(
        `${columnName} ${sqlType} GENERATED ALWAYS AS (${expression}) VIRTUAL`
      )
    }
  }

  // Create table
  const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${ctx.tableSql} (
        ${columns.join(",\n        ")}
      )
    `
  ctx.sql.run(createTableSQL)

  evolveGeneratedColumns({
    database: ctx.db,
    sql: ctx.sql,
    collection: ctx.name,
    schema: ctx.schema,
  })

  // Create indexes
  createIndexes(ctx)
}

function createIndexes<T extends Document>(ctx: DDLContext<T>): void {
  for (const field of ctx.schema.fields) {
    if (field.indexed) {
      const columnName = generatedColumn(String(field.name))
      const indexName = quoteIdent(`idx_${ctx.name}_${String(field.name)}`)
      const uniqueKeyword = field.unique ? "UNIQUE" : ""

      const createIndexSQL = `
          CREATE ${uniqueKeyword} INDEX IF NOT EXISTS ${indexName}
          ON ${ctx.tableSql}(${columnName})
        `
      ctx.sql.run(createIndexSQL)
    }
  }
  for (const index of ctx.schema.compoundIndexes ?? []) {
    if (!Array.isArray(index.fields) || index.fields.length === 0) {
      throw new SchemaValidationError(
        "A compound index requires at least one field"
      )
    }
    const name = compoundIndexName(ctx.name, index.name)
    const columns = index.fields.map((field) =>
      resolveDDLField(String(field), ctx.schema.fields)
    )
    const unique = index.unique ? "UNIQUE" : ""
    ctx.sql.run(
      `CREATE ${unique} INDEX IF NOT EXISTS ${name} ON ${ctx.tableSql} (${columns.join(", ")})`
    )
  }
}

function mapTypeToSQLite(
  type: "TEXT" | "INTEGER" | "REAL" | "BLOB" | "BOOLEAN" | "NUMERIC"
): "TEXT" | "INTEGER" | "REAL" | "BLOB" | "NUMERIC" {
  switch (type) {
    case "TEXT":
      return "TEXT"
    case "INTEGER":
      return "INTEGER"
    case "REAL":
      return "REAL"
    case "BLOB":
      return "BLOB"
    case "BOOLEAN":
      return "INTEGER" // SQLite doesn't have BOOLEAN, use INTEGER (0/1)
    case "NUMERIC":
      return "NUMERIC"
    default:
      return "TEXT" // Fallback to TEXT for unknown types
  }
}
