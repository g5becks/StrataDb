import { expect, test } from "bun:test"
import { TransactionError } from "../../src/errors.js"
import { createSchema, type Document, Strata } from "../../src/index.js"

type Item = Document<{ key: string; value: number }>
const schema = () => createSchema<Item>().build()

test("A4 [TASK-232] outside synchronous DDL cannot join a pending execute", async () => {
  using db = new Strata({ database: ":memory:" })
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const transaction = db.execute(async () => {
    entered.resolve()
    await release.promise
  })
  await entered.promise
  expect(() => db.collection("outside", schema())).toThrow(TransactionError)
  expect(() => db.transaction()).toThrow(TransactionError)
  release.resolve()
  await transaction
  expect(await db.collection("outside", schema()).count({})).toBe(0)
})

for (const method of [
  "insertOne",
  "insertMany",
  "updateOne",
  "updateMany",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "findOneAndDelete",
  "drop",
] as const) {
  test(`A4 [TASK-232] ${method} nests and rolls back without events`, async () => {
    using db = new Strata({ database: ":memory:" })
    const items = db.collection("items", schema())
    const item = await items.insertOne({ key: "original", value: 1 })
    const events: string[] = []
    for (const event of [
      "insert",
      "insertMany",
      "update",
      "updateMany",
      "replace",
      "delete",
      "deleteMany",
      "findOneAndUpdate",
      "findOneAndReplace",
      "findOneAndDelete",
      "drop",
    ] as const) {
      items.on(event, () => events.push(event))
    }
    await expect(
      db.execute(async () => {
        switch (method) {
          case "insertOne":
            await items.insertOne({ key: "new", value: 2 })
            break
          case "insertMany":
            await items.insertMany([{ key: "new", value: 2 }])
            break
          case "updateOne":
            await items.updateOne(item._id, { value: 2 })
            break
          case "updateMany":
            await items.updateMany({}, { value: 2 })
            break
          case "replaceOne":
            await items.replaceOne(item._id, { key: "changed", value: 2 })
            break
          case "deleteOne":
            await items.deleteOne(item._id)
            break
          case "deleteMany":
            await items.deleteMany({})
            break
          case "findOneAndUpdate":
            await items.findOneAndUpdate(item._id, { value: 2 })
            break
          case "findOneAndReplace":
            await items.findOneAndReplace(item._id, {
              key: "changed",
              value: 2,
            })
            break
          case "findOneAndDelete":
            await items.findOneAndDelete(item._id)
            break
          case "drop":
            await items.drop()
            break
          default:
            throw new Error("Unknown write method")
        }
        expect(events).toEqual([])
        throw new Error("intentional rollback")
      })
    ).rejects.toThrow("intentional rollback")
    expect(
      (await items.find({})).map((doc) => ({ key: doc.key, value: doc.value }))
    ).toEqual([{ key: "original", value: 1 }])
    expect(events).toEqual([])
    await items.insertOne({ key: "after", value: 3 })
    expect(events).toEqual(["insert"])
  })
}

test("A4 [TASK-232] nested execute savepoints commit and roll back independently", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", schema())
  const events: string[] = []
  const eventTransactionStates: boolean[] = []
  items.on("insert", ({ document }) => {
    events.push(document.key)
    eventTransactionStates.push(db.sqliteDb.inTransaction)
  })
  await db.execute(async () => {
    await items.insertOne({ key: "outer", value: 1 })
    await db.execute(async () => {
      await items.insertOne({ key: "nested", value: 2 })
    })
    await expect(
      db.execute(async () => {
        await items.insertOne({ key: "rolled_back", value: 3 })
        throw new Error("nested rollback")
      })
    ).rejects.toThrow("nested rollback")
    expect(events).toEqual([])
    expect(await items.count({})).toBe(2)
  })
  expect(events).toEqual(["outer", "nested"])
  expect(eventTransactionStates).toEqual([false, false])
  expect(
    (await items.find({}, { sort: { key: 1 } })).map((doc) => doc.key)
  ).toEqual(["nested", "outer"])
})

test("A4 [TASK-232] concurrent sibling execute calls use separate savepoints", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", schema())
  await db.execute(async () => {
    const results = await Promise.allSettled([
      db.execute(async () => {
        await items.insertOne({ key: "kept", value: 1 })
        await Promise.resolve()
      }),
      db.execute(async () => {
        await items.insertOne({ key: "discarded", value: 2 })
        throw new Error("sibling rollback")
      }),
    ])
    expect(results.map((result) => result.status)).toEqual([
      "fulfilled",
      "rejected",
    ])
  })
  expect((await items.find({})).map((doc) => doc.key)).toEqual(["kept"])
})

test("A4 [TASK-232] competing execute callbacks serialize", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", schema())
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const order: string[] = []
  const first = db.execute(async () => {
    order.push("first")
    entered.resolve()
    await release.promise
    await items.insertOne({ key: "first", value: 1 })
  })
  await entered.promise
  const second = db.execute(async () => {
    order.push("second")
    await items.insertOne({ key: "second", value: 2 })
  })
  const outside = items.insertOne({ key: "outside", value: 3 })
  release.resolve()
  await Promise.all([first, second, outside])
  expect(order).toEqual(["first", "second"])
  expect(await items.count({})).toBe(3)
})

test("A4 [TASK-232] manual transaction handles nest and dispose idempotently", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", schema())
  const events: string[] = []
  items.on("insert", ({ document }) => events.push(document.key))
  using outer = db.transaction()
  await items.insertOne({ key: "outer", value: 1 })
  {
    using inner = db.transaction()
    await items.insertOne({ key: "discarded", value: 2 })
    inner.rollback()
  }
  expect(events).toEqual([])
  outer.commit()
  expect(events).toEqual(["outer"])
  expect((await items.find({})).map((doc) => doc.key)).toEqual(["outer"])
})

test("A4 [TASK-232] transaction collection forwards options", async () => {
  let validations = 0
  using db = new Strata({
    database: ":memory:",
    retry: { retries: 1, minTimeout: 1 },
  })
  const invalidSchema = createSchema<Item>()
    .validate((_value): _value is Item => {
      validations += 1
      return false
    })
    .build()
  await expect(
    db.execute(async (tx) => {
      const items = tx.collection("invalid", invalidSchema, { retry: false })
      await items.insertOne({ key: "invalid", value: 1 })
    })
  ).rejects.toThrow("validation")
  expect(validations).toBe(1)
})
