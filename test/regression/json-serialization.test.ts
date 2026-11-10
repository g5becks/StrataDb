import { expect, test } from "bun:test"
import {
  createSchema,
  type Document,
  Strata,
  ValidationError,
} from "../../src/index.js"

type Item = Document<{ name: string; payload?: unknown }>
const cycle = (): Record<string, unknown> => {
  const value: Record<string, unknown> = {}
  value.self = value
  return value
}
for (const operation of [
  "insert",
  "batch",
  "update",
  "replace",
  "updateMany",
] as const) {
  test(`[TASK-254] circular ${operation} rejects with ValidationError and no partial writes`, async () => {
    using db = new Strata({ database: ":memory:" })
    const items = db.collection("items", createSchema<Item>().build())
    await items.insertOne({ _id: "one", name: "original" })
    let events = 0
    items.on("insert", () => {
      events += 1
    })
    items.on("update", () => {
      events += 1
    })
    const bad = { name: "bad", payload: cycle() }
    const run = () => {
      switch (operation) {
        case "insert":
          return items.insertOne(bad)
        case "batch":
          return items.insertMany([{ name: "first" }, bad])
        case "update":
          return items.updateOne("one", bad)
        case "replace":
          return items.replaceOne("one", bad)
        case "updateMany":
          return items.updateMany({}, bad)
        default:
          throw new Error("Unknown operation")
      }
    }
    const promise = run()
    expect(promise).toBeInstanceOf(Promise)
    await expect(promise).rejects.toBeInstanceOf(ValidationError)
    expect(await items.count({})).toBe(1)
    expect((await items.findById("one"))?.name).toBe("original")
    expect(events).toBe(0)
  })
}
