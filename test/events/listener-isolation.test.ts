import { expect, test } from "bun:test"
import { createSchema, type Document, Strata } from "../../src/index.js"

type Item = Document<{ name: string }>

test("A6 [TASK-233] failed listeners preserve order, once delivery and committed writes", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", createSchema<Item>().build())
  const order: string[] = []
  const errors: Error[] = []
  items.on("error", ({ error, operation }) => {
    expect(operation).toBe("insert")
    errors.push(error)
  })
  items.on("insert", () => {
    order.push("first")
    throw new Error("first listener")
  })
  items.once("insert", () => {
    order.push("once")
    throw new Error("once listener")
  })
  items.on("insert", () => {
    order.push("last")
  })
  await items.insertOne({ name: "one" })
  await items.insertOne({ name: "two" })
  expect(order).toEqual(["first", "once", "last", "first", "last"])
  expect(errors.map((error) => error.message)).toEqual([
    "first listener",
    "once listener",
    "first listener",
  ])
  expect(await items.count({})).toBe(2)
})

test("A6 [TASK-233] listener errors do not enter retries", async () => {
  let retries = 0
  using db = new Strata({
    database: ":memory:",
    retry: {
      retries: 1,
      minTimeout: 1,
      onFailedAttempt: () => {
        retries += 1
      },
    },
  })
  const items = db.collection("items", createSchema<Item>().build())
  items.on("error", () => {
    /* Expected listener failure. */
  })
  items.on("insert", () => {
    throw new Error("listener")
  })
  await items.insertOne({ name: "once" })
  expect(await items.count({})).toBe(1)
  expect(retries).toBe(0)
})

test("A6 [TASK-233] committed transaction flush continues after listener failures", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", createSchema<Item>().build())
  const delivered: string[] = []
  items.on("error", () => {
    /* Expected listener failure. */
  })
  items.on("insert", () => {
    throw new Error("listener")
  })
  items.on("insert", ({ document }) => delivered.push(document.name))
  await db.execute(async () => {
    await items.insertOne({ name: "one" })
    await items.insertOne({ name: "two" })
    expect(delivered).toEqual([])
  })
  expect(delivered).toEqual(["one", "two"])
  expect(await items.count({})).toBe(2)
})

test("A6 [TASK-233] default logging and failing error observers do not recurse", async () => {
  const original = console.error
  const logged: unknown[][] = []
  console.error = (...args: unknown[]) => {
    logged.push(args)
  }
  try {
    using db = new Strata({ database: ":memory:" })
    const items = db.collection("items", createSchema<Item>().build())
    items.on("insert", () => {
      throw new Error("unobserved")
    })
    await items.insertOne({ name: "default" })
    expect(logged).toHaveLength(1)
    items.on("error", () => {
      throw new Error("error observer")
    })
    let observed = 0
    items.on("error", () => {
      observed += 1
    })
    await items.insertOne({ name: "observed" })
    expect(logged).toHaveLength(2)
    expect(observed).toBe(1)
    expect(await items.count({})).toBe(2)
  } finally {
    console.error = original
  }
})

test("A6 [TASK-233] async listener rejections are observed without rejecting writes", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection("items", createSchema<Item>().build())
  const observed = Promise.withResolvers<Error>()
  items.on("error", ({ error }) => observed.resolve(error))
  items.on("insert", async () => {
    await Promise.resolve()
    throw new Error("async listener")
  })
  await items.insertOne({ name: "one" })
  expect((await observed.promise).message).toBe("async listener")
  expect(await items.count({})).toBe(1)
})
