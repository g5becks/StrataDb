/** Fixed indexed findOne protocol: same fixture/source selector before and after. */
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import type { Document } from "../src/index.js"

const source = resolve(process.argv[2] ?? resolve(import.meta.dir, ".."))
const api = (await import(
  pathToFileURL(resolve(source, "src/index.ts")).href
)) as typeof import("../src/index.js")
const { Strata, createSchema } = api
const iterations = 50_000
const warmup = 5000
const trials = 5
type User = Document<{
  name: string
  email: string
  age: number
  role: string
  status: string
  tags: string[]
  score: number
}>
const schema = createSchema<User>()
  .field("name", { type: "TEXT", indexed: true })
  .field("email", { type: "TEXT", indexed: true, unique: true })
  .field("age", { type: "INTEGER", indexed: true })
  .field("role", { type: "TEXT", indexed: true })
  .field("status", { type: "TEXT" })
  .field("tags", { type: "BLOB" })
  .field("score", { type: "INTEGER", indexed: true })
  .build()
const results: {
  translatorCache: boolean
  usPerOp: number[]
  medianUs: number | undefined
  sqlite: string | undefined
}[] = []
for (const enableCache of [false, true]) {
  using db = new Strata({ database: ":memory:", enableCache })
  const users = db.collection("users", schema)
  await users.insertMany(
    Array.from({ length: 100 }, (_, index) => ({
      _id: `user-${String(index).padStart(3, "0")}`,
      name: `User ${index}`,
      email: `user${index}@example.com`,
      age: 20 + (index % 50),
      role: index % 10 === 0 ? "admin" : "user",
      status: "active",
      tags: ["tag1", "tag2"],
      score: index * 10,
    }))
  )
  for (let index = 0; index < warmup; index += 1) {
    await users.findOne({ role: "admin" })
  }
  const samples: number[] = []
  for (let trial = 0; trial < trials; trial += 1) {
    const start = performance.now()
    for (let index = 0; index < iterations; index += 1) {
      const row = await users.findOne({ role: "admin" })
      if (row?._id !== "user-000") {
        throw new Error("Benchmark returned an incorrect row")
      }
    }
    samples.push(((performance.now() - start) * 1000) / iterations)
  }
  results.push({
    translatorCache: enableCache,
    usPerOp: samples,
    medianUs: samples.toSorted((a, b) => a - b)[2],
    sqlite: db.sqliteDb
      .query<{ v: string }, []>("SELECT sqlite_version() AS v")
      .get()?.v,
  })
}
const sha = Bun.spawnSync(["git", "-C", source, "rev-parse", "HEAD"])
  .stdout.toString()
  .trim()
const dirty =
  Bun.spawnSync(["git", "-C", source, "diff", "--quiet"]).exitCode !== 0
console.log(
  JSON.stringify(
    {
      source,
      sha,
      dirty,
      bun: Bun.version,
      platform: process.platform,
      arch: process.arch,
      iterations,
      warmup,
      trials,
      results,
    },
    null,
    2
  )
)
