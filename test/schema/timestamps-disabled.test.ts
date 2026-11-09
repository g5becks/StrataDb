import { expect, test } from "bun:test"
import { createSchema, type Document, Strata } from "../../src/index.js"

type Item = Document<{ name: string; value: number }>

test("A9 [TASK-236] disabled timestamps are absent from every returned document and event", async () => {
  using db = new Strata({ database: ":memory:" })
  const items = db.collection(
    "items",
    createSchema<Item>().timestamps(false).build()
  )
  const documents: unknown[] = []
  for (const event of [
    "insert",
    "insertMany",
    "update",
    "replace",
    "findOneAndUpdate",
    "findOneAndReplace",
    "findOneAndDelete",
  ] as const) {
    items.on(event, (payload) => {
      if ("document" in payload && payload.document) {
        documents.push(payload.document)
      }
      if ("documents" in payload) {
        documents.push(...payload.documents)
      }
    })
  }
  const inserted = await items.insertOne({ name: "one", value: 1 })
  documents.push(inserted)
  documents.push(
    ...(await items.insertMany([{ name: "two", value: 2 }])).documents
  )
  documents.push(await items.updateOne(inserted._id, { value: 3 }))
  documents.push(
    await items.replaceOne(inserted._id, { name: "one", value: 4 })
  )
  documents.push(...(await items.find({})))
  documents.push(
    await items.findOne(inserted._id),
    await items.findById(inserted._id)
  )
  documents.push(
    ...(await items.find({}, {
      projection: { name: 1, createdAt: 1, updatedAt: 1 },
    } as never))
  )
  documents.push(
    await items.findOneAndUpdate(
      inserted._id,
      { value: 5 },
      { returnDocument: "before" }
    )
  )
  documents.push(
    await items.findOneAndReplace(
      inserted._id,
      { name: "one", value: 6 },
      { returnDocument: "after" }
    )
  )
  documents.push(await items.findOneAndDelete(inserted._id))
  documents.push(
    await items.updateOne({ name: "upsert" }, { value: 7 }, { upsert: true })
  )
  documents.push(
    await items.findOneAndUpdate(
      { name: "upsert_update" },
      { value: 8 },
      { upsert: true }
    )
  )
  documents.push(
    await items.findOneAndReplace(
      { name: "upsert_replace" },
      { name: "upsert_replace", value: 9 },
      { upsert: true }
    )
  )
  await items.updateMany({}, { value: 10 })
  documents.push(...(await items.find({})))
  for (const document of documents) {
    expect(document).not.toBeNull()
    expect(document).toHaveProperty("_id")
    expect(document).not.toHaveProperty("createdAt")
    expect(document).not.toHaveProperty("updatedAt")
  }
  for (const row of db.sqliteDb
    .query<{ createdAt: number; updatedAt: number }, []>(
      "SELECT createdAt, updatedAt FROM items"
    )
    .all()) {
    expect(typeof row.createdAt).toBe("number")
    expect(typeof row.updatedAt).toBe("number")
  }
})

for (const timestamps of [undefined, true]) {
  test(`A9 [TASK-236] enabled/default timestamps remain visible (${String(timestamps)})`, async () => {
    using db = new Strata({ database: ":memory:" })
    const builder = createSchema<Item>()
    if (timestamps !== undefined) {
      builder.timestamps(timestamps)
    }
    const items = db.collection("items", builder.build())
    const inserted = await items.insertOne({ name: "one", value: 1 })
    expect(inserted).toMatchObject({
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
    })
    expect(await items.findById(inserted._id)).toMatchObject({
      createdAt: inserted.createdAt,
    })
  })
}
