import { bench, run } from "mitata"
import { createSchema, type Document, Strata } from "../src/index.js"

using db = new Strata({ database: ":memory:" })
const items = db.collection(
  "items",
  createSchema<Document<{ name: string }>>()
    .field("name", { type: "TEXT", indexed: true })
    .build()
)
await items.insertMany(
  Array.from({ length: 1000 }, (_, i) => ({
    name: `${i % 2 ? "Émile" : "Alice"} ${i}`,
  }))
)
bench("ilike 1000 rows ASCII", async () => {
  await items.count({ name: { $ilike: "%alice%" } })
})
bench("ilike 1000 rows Unicode", async () => {
  await items.count({ name: { $ilike: "%émile%" } })
})
bench("search 1000 rows ASCII", async () => {
  await items.search("alice", ["name"])
})
bench("search 1000 rows Unicode", async () => {
  await items.search("émile", ["name"])
})
await run({ throw: true, colors: false })
