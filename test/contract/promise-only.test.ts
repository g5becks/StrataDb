import { expect, test } from "bun:test"
import { createSchema, type Document, Strata } from "../../src/index.js"
import { withRetry } from "../../src/retry-utils.js"

type Item = Document<{ name: string }>

for (const retries of [0, 1]) {
  test(`A5 [TASK-230] all async methods return rejecting promises, retries=${retries}`, async () => {
    using db = new Strata({
      database: ":memory:",
      retry: { retries, minTimeout: 1 },
    })
    const items = db.collection("items", createSchema<Item>().build())
    const invalid = db.collection(
      "invalid",
      createSchema<Item>()
        .validate((_value): _value is Item => false)
        .build()
    )
    // A dropped table forces an error inside each operation rather than using
    // the already promise-safe closed-database guard.
    db.sqliteDb.exec('DROP TABLE "items"')
    const document = { name: "test" }
    const methods: Record<string, () => Promise<unknown>> = {
      findById: () => items.findById("missing"),
      find: () => items.find({}),
      findOne: () => items.findOne({}),
      count: () => items.count({}),
      search: () => items.search("test", ["name"]),
      insertOne: () => items.insertOne(document),
      insertMany: () => items.insertMany([document]),
      updateOne: () => items.updateOne("missing", document),
      updateMany: () => items.updateMany({}, document),
      replaceOne: () => items.replaceOne("missing", document),
      deleteOne: () => items.deleteOne("missing"),
      deleteMany: () => items.deleteMany({}),
      findOneAndDelete: () => items.findOneAndDelete("missing"),
      findOneAndUpdate: () => items.findOneAndUpdate("missing", document),
      findOneAndReplace: () => items.findOneAndReplace("missing", document),
      distinct: () => items.distinct("name"),
      estimatedDocumentCount: () => items.estimatedDocumentCount(),
      validate: () => invalid.validate(document),
      execute: () =>
        db.execute(() => {
          throw new Error("callback error")
        }),
    }
    for (const [name, method] of Object.entries(methods)) {
      let result: Promise<unknown> | undefined
      let synchronousError: unknown
      try {
        result = method()
        result.catch(() => {
          /* Assert rejection below without an unhandled promise. */
        })
      } catch (error) {
        synchronousError = error
      }
      expect(synchronousError, `${name} threw synchronously`).toBeUndefined()
      expect(result, `${name} did not return a promise`).toBeInstanceOf(Promise)
      await expect(result).rejects.toBeInstanceOf(Error)
    }
    // DROP TABLE IF EXISTS is idempotent; closing supplies its error path.
    db.close()
    const dropped = items.drop()
    expect(dropped).toBeInstanceOf(Promise)
    await expect(dropped).rejects.toBeInstanceOf(Error)
  })

  test(`A5 [TASK-230] withRetry captures a throwing callback, retries=${retries}`, async () => {
    const error = new Error("synchronous callback")
    let result: Promise<unknown> | undefined
    expect(() => {
      result = withRetry(
        () => {
          throw error
        },
        { retries, minTimeout: 1 }
      )
      result.catch(() => {
        /* Assert rejection below. */
      })
    }).not.toThrow()
    expect(result).toBeInstanceOf(Promise)
    await expect(result).rejects.toBe(error)
  })
}
