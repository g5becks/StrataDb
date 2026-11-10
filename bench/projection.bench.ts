/** Same 50-field fixture and two-field projection before and after TASK-253. */
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import type { Document } from "../src/index.js"

const source = resolve(process.argv[2] ?? resolve(import.meta.dir, ".."))
const { Strata, createSchema } = (await import(
  pathToFileURL(resolve(source, "src/index.ts")).href
)) as typeof import("../src/index.js")
type Wide = Document<Record<`field${number}`, string>>
using db = new Strata({ database: ":memory:" })
const items = db.collection("wide", createSchema<Wide>().build())
const fixture = Object.fromEntries(
  Array.from({ length: 50 }, (_, index) => [
    `field${index}`,
    `${index}:`.padEnd(512, "x"),
  ])
)
await items.insertOne({ _id: "wide", ...fixture })
const warmup = 5000
const iterations = 50_000
const trials = 5
const read = () =>
  items.findOne({ _id: "wide" }, { select: ["field0", "field49"] })
for (let index = 0; index < warmup; index += 1) {
  await read()
}
const usPerOp: number[] = []
for (let trial = 0; trial < trials; trial += 1) {
  const start = performance.now()
  for (let index = 0; index < iterations; index += 1) {
    const row = await read()
    if (
      row?.field0 !== fixture.field0 ||
      row.field49 !== fixture.field49 ||
      Object.keys(row).length !== 3
    ) {
      throw new Error("Incorrect projected row")
    }
  }
  usPerOp.push(((performance.now() - start) * 1000) / iterations)
}
console.log(
  JSON.stringify(
    {
      source,
      sha: Bun.spawnSync(["git", "-C", source, "rev-parse", "HEAD"])
        .stdout.toString()
        .trim(),
      dirty:
        Bun.spawnSync(["git", "-C", source, "diff", "--quiet"]).exitCode !== 0,
      bun: Bun.version,
      platform: process.platform,
      arch: process.arch,
      warmup,
      iterations,
      trials,
      usPerOp,
      medianUs: usPerOp.toSorted((a, b) => a - b)[2],
    },
    null,
    2
  )
)
