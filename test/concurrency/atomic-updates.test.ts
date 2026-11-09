import { expect, test } from "bun:test"
import { createSchema, type Document, Strata } from "../../src/index.js"

type Job = Document<{ key: string; state: string; a?: number; b?: number }>

for (const method of [
  "updateOne",
  "replaceOne",
  "findOneAndUpdate",
  "findOneAndReplace",
  "findOneAndDelete",
] as const) {
  test(`A3 [TASK-231] ${method} conditional race has exactly one winner`, async () => {
    using db = new Strata({ database: ":memory:" })
    const jobs = db.collection(
      "jobs",
      createSchema<Job>()
        .field("key", { type: "TEXT", indexed: true, unique: true })
        .build()
    )
    await jobs.insertOne({ key: "job", state: "pending" })
    const compete = () =>
      method === "findOneAndDelete"
        ? jobs.findOneAndDelete({ key: "job", state: "pending" })
        : jobs[method](
            { key: "job", state: "pending" },
            { key: "job", state: "running" }
          )
    const results = await Promise.all([compete(), compete()])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await jobs.count({})).toBe(method === "findOneAndDelete" ? 0 : 1)
  })
}

for (const method of ["updateOne", "findOneAndUpdate"] as const) {
  test(`A3 [TASK-231] ${method} retains concurrent different-field updates`, async () => {
    using db = new Strata({ database: ":memory:" })
    const jobs = db.collection("jobs", createSchema<Job>().build())
    const job = await jobs.insertOne({ key: "job", state: "pending" })
    await Promise.all([
      jobs[method](job._id, { a: 1 }),
      jobs[method](job._id, { b: 2 }),
    ])
    expect(await jobs.findById(job._id)).toMatchObject({ a: 1, b: 2 })
  })
}

for (const method of [
  "updateOne",
  "findOneAndUpdate",
  "findOneAndReplace",
] as const) {
  test(`A3 [TASK-231] ${method} concurrent upsert inserts once`, async () => {
    using db = new Strata({ database: ":memory:" })
    const jobs = db.collection("jobs", createSchema<Job>().build())
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        jobs[method](
          { key: "job" },
          { key: "job", state: "running" },
          { upsert: true }
        )
      )
    )
    expect(await jobs.count({ key: "job" })).toBe(1)
    expect(new Set(results.map((job) => job?._id)).size).toBe(1)
  })
}

test("A3 [TASK-231] metadata stays in columns across all insert/update/replace paths", async () => {
  using db = new Strata({ database: ":memory:" })
  const jobs = db.collection("jobs", createSchema<Job>().build())
  const inserted = await jobs.insertOne({ key: "one", state: "pending" })
  const operations = [
    () => jobs.insertOne({ key: "raw", state: "pending" }),
    () => jobs.insertMany([{ key: "two", state: "pending" }]),
    () => jobs.updateOne(inserted._id, { a: 1 }),
    () => jobs.updateMany({}, { b: 2 }),
    () => jobs.replaceOne(inserted._id, { key: "one", state: "replaced" }),
    () => jobs.findOneAndUpdate(inserted._id, { a: 3 }),
    () => jobs.findOneAndReplace(inserted._id, { key: "one", state: "final" }),
  ]
  for (const operation of operations) {
    await operation()
    for (const row of db.sqliteDb
      .query<{ body: string }, []>('SELECT json(body) AS body FROM "jobs"')
      .all()) {
      const body = JSON.parse(row.body)
      expect(body).not.toHaveProperty("_id")
      expect(body).not.toHaveProperty("createdAt")
      expect(body).not.toHaveProperty("updatedAt")
    }
  }
  expect(await jobs.findById(inserted._id)).toMatchObject({
    createdAt: inserted.createdAt,
    state: "final",
  })
})
