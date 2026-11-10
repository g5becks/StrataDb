import { expect, test } from "bun:test"
import {
  createSchema,
  type DeleteEvent,
  type DeleteManyEvent,
  type Document,
  Strata,
  type UpdateManyEvent,
} from "../../src/index.js"

type Item = Document<{ name: string; count: number }>

test("A17 [TASK-244] delete payloads identify the resolved row and optionally include it", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection(
    "items",
    createSchema<Item>().timestamps(false).build()
  )
  const events: DeleteEvent<Item>[] = []
  items.on("delete", (event) => events.push(event))
  await items.insertMany([
    { _id: "a", name: "A", count: 1 },
    { _id: "b", name: "B", count: 2 },
  ])
  expect(await items.deleteOne({ name: "A" }, { includeDocument: true })).toBe(
    true
  )
  expect(events[0]).toEqual({
    filter: { name: "A" },
    deleted: true,
    _id: "a",
    document: { _id: "a", name: "A", count: 1 },
  })
  expect(await items.deleteOne("b")).toBe(true)
  expect(events[1]).toEqual({ filter: "b", deleted: true, _id: "b" })
  expect(await items.deleteOne("missing")).toBe(false)
  expect(events[2]).toEqual({ filter: "missing", deleted: false, _id: null })
})

test("A17 [TASK-244] batch events contain exact affected IDs, including empty batches", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", createSchema<Item>().build())
  const updated: UpdateManyEvent<Item>[] = []
  const deleted: DeleteManyEvent<Item>[] = []
  items.on("updateMany", (event) => updated.push(event))
  items.on("deleteMany", (event) => deleted.push(event))
  await items.insertMany([
    { _id: "a", name: "A", count: 1 },
    { _id: "b", name: "B", count: 1 },
    { _id: "c", name: "C", count: 2 },
  ])
  expect(await items.updateMany({ count: 1 }, { count: 3 })).toEqual({
    matchedCount: 2,
    modifiedCount: 2,
  })
  expect(updated[0]?.ids.toSorted()).toEqual(["a", "b"])
  expect(await items.deleteMany({ count: 3 })).toEqual({ deletedCount: 2 })
  expect(deleted[0]?.ids.toSorted()).toEqual(["a", "b"])
  await items.updateMany({ count: 99 }, { count: 0 })
  await items.deleteMany({ count: 99 })
  expect(updated[1]?.ids).toEqual([])
  expect(deleted[1]?.ids).toEqual([])
  expect(await items.findOne("c")).not.toBeNull()
})

test("[TASK-244] batch update IDs describe actual RETURNING rows", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", createSchema<Item>().build())
  const updated: UpdateManyEvent<Item>[] = []
  items.on("updateMany", (event) => updated.push(event))
  await items.insertMany([
    { _id: "a", name: "A", count: 1 },
    { _id: "b", name: "B", count: 1 },
  ])
  db.sqliteDb.exec(
    "CREATE TRIGGER skip_a BEFORE UPDATE ON items WHEN OLD._id='a' BEGIN SELECT RAISE(IGNORE); END"
  )
  expect(await items.updateMany({ count: 1 }, { count: 2 })).toEqual({
    matchedCount: 2,
    modifiedCount: 1,
  })
  expect(updated[0]?.ids).toEqual(["b"])
})

test("[TASK-244] rich delete payloads remain buffered and discarded on rollback", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", createSchema<Item>().build())
  const deleted: DeleteEvent<Item>[] = []
  items.on("delete", (event) => deleted.push(event))
  await items.insertOne({ _id: "a", name: "A", count: 1 })
  await expect(
    db.execute(async () => {
      await items.deleteOne("a", { includeDocument: true })
      expect(deleted).toEqual([])
      throw new Error("rollback")
    })
  ).rejects.toThrow("rollback")
  expect(deleted).toEqual([])
  expect(await items.findOne("a")).not.toBeNull()
  await db.execute(async () => {
    await items.deleteOne("a", { includeDocument: true })
    expect(deleted).toEqual([])
  })
  expect(deleted[0]).toMatchObject({
    _id: "a",
    deleted: true,
    document: { _id: "a", name: "A" },
  })
})
