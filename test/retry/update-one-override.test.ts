import { expect, test } from "bun:test"
import {
  createSchema,
  type Document,
  type RetryOptions,
  Strata,
  ValidationError,
} from "../../src/index.js"

type Item = Document<{ n: number }>
const retry = (shouldRetry: boolean): RetryOptions => ({
  retries: 1,
  minTimeout: 1,
  maxTimeout: 1,
  randomize: false,
  shouldRetry: () => shouldRetry,
})
for (const level of ["database", "collection"] as const) {
  test(`[TASK-265] updateOne retry:false overrides ${level} retries`, async () => {
    let attempts = 0
    const schema = createSchema<Item>()
      .validate((doc: unknown): doc is Item => {
        attempts += 1
        return typeof (doc as Item).n === "number"
      })
      .build()
    using db = new Strata({
      database: ":memory:",
      ...(level === "database" ? { retry: retry(true) } : {}),
    })
    const items = db.collection(
      "items",
      schema,
      level === "collection" ? { retry: retry(true) } : {}
    )
    await items.insertOne({ _id: "one", n: 1 })
    attempts = 0
    let events = 0
    items.on("update", () => {
      events += 1
    })
    const promise = items.updateOne("one", { n: "bad" } as never, {
      retry: false,
    })
    expect(promise).toBeInstanceOf(Promise)
    await expect(promise).rejects.toBeInstanceOf(ValidationError)
    expect(attempts).toBe(1)
    expect((await items.findById("one"))?.n).toBe(1)
    expect(events).toBe(0)
  })
}

test("[TASK-265] updateOne explicit retry count/predicate overrides inherited defaults", async () => {
  let attempts = 0
  let decisions = 0
  let inheritedDecisions = 0
  const schema = createSchema<Item>()
    .validate((doc: unknown): doc is Item => {
      attempts += 1
      return typeof (doc as Item).n === "number"
    })
    .build()
  using db = new Strata({
    database: ":memory:",
    retry: {
      ...retry(false),
      shouldRetry: () => {
        inheritedDecisions += 1
        return false
      },
    },
  })
  const items = db.collection("items", schema)
  await items.insertOne({ _id: "one", n: 1 })
  attempts = 0
  const promise = items.updateOne("one", { n: "bad" } as never, {
    retry: {
      ...retry(true),
      retries: 2,
      shouldRetry: (context) => {
        decisions += 1
        expect(context.error).toBeInstanceOf(ValidationError)
        return true
      },
    },
  })
  expect(promise).toBeInstanceOf(Promise)
  await expect(promise).rejects.toBeInstanceOf(ValidationError)
  expect(attempts).toBe(3)
  expect(decisions).toBe(2)
  expect(inheritedDecisions).toBe(0)
  expect((await items.findById("one"))?.n).toBe(1)
})
