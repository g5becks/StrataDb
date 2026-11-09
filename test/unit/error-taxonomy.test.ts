import { expect, test } from "bun:test"
import {
  AbortedError,
  ConnectionError,
  ConstraintError,
  DatabaseError,
  InvalidQueryOperatorError,
  QueryError,
  SchemaValidationError,
  StrataDBError,
  TransactionAbortedError,
  TransactionError,
  TypeMismatchError,
  UniqueConstraintError,
  ValidationError,
} from "../../src/index.js"

test("A19 [TASK-234] error classes retain categories, metadata and compatibility exports", () => {
  const errors = [
    new ValidationError("invalid", "name", 42),
    new SchemaValidationError("schema", "name", null),
    new QueryError("query", "SELECT invalid"),
    new InvalidQueryOperatorError("operator", "bad query"),
    new TypeMismatchError("type", {
      field: "name",
      expectedType: "string",
      actualType: "number",
      query: "filter",
    }),
    new DatabaseError("database", 11),
    new ConnectionError("connection", 5),
    new ConstraintError("constraint", "CHECK", 19),
    new UniqueConstraintError("unique", "name", "duplicate", 2067),
    new TransactionError("transaction"),
    new TransactionAbortedError("transaction aborted"),
    new AbortedError("aborted", "reason"),
  ]
  for (const error of errors) {
    expect(error).toBeInstanceOf(StrataDBError)
    expect(error.name).toBe(error.constructor.name)
    expect(error.code.length).toBeGreaterThan(0)
    expect(["validation", "query", "database", "transaction"]).toContain(
      error.category
    )
    expect(error.stack).toContain(error.message)
  }
  expect(errors[0]).toMatchObject({ field: "name", value: 42 })
  expect(errors[1]).toMatchObject({ field: "name", value: null })
  expect(errors[2]).toMatchObject({ query: "SELECT invalid" })
  expect(errors[3]).toMatchObject({ query: "bad query" })
  expect(errors[4]).toMatchObject({
    field: "name",
    expectedType: "string",
    actualType: "number",
    query: "filter",
  })
  expect(errors[7]).toMatchObject({ constraint: "CHECK", sqliteCode: 19 })
  expect(errors[8]).toMatchObject({
    field: "name",
    value: "duplicate",
    sqliteCode: 2067,
  })
  expect(errors[11]).toHaveProperty("reason", "reason")
})
