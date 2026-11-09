import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const root = new URL("../", import.meta.url).pathname
const temporary = await mkdtemp(join(tmpdir(), "stratadb-consumer-"))

async function run(command: string[], cwd: string): Promise<void> {
  const process = Bun.spawn(command, {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  })
  const code = await process.exited
  if (code !== 0) {
    throw new Error(`${command.join(" ")} exited ${code}`)
  }
}

try {
  const metadata = await Bun.file(join(root, "package.json")).json()
  await run(["bun", "pm", "pack", "--destination", temporary], root)
  await Bun.write(
    join(temporary, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        stratadb: `file:./stratadb-${metadata.version}.tgz`,
        "@types/bun": "1.4.4",
        "@types/node": "^26",
      },
    })
  )
  await Bun.write(
    join(temporary, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        types: ["bun"],
      },
      include: ["consumer.ts"],
    })
  )
  await Bun.write(
    join(temporary, "consumer.ts"),
    `import assert from "node:assert/strict"
import { Strata, createSchema, type Document } from "stratadb"
import metadata from "stratadb/package.json" with { type: "json" }

type User = Document<{ name: string; age: number }>
using db = new Strata({ database: ":memory:" })
const users = db.collection("users", createSchema<User>()
  .field("name", { type: "TEXT", indexed: true })
  .field("age", { type: "INTEGER" }).build())
const inserted = await users.insertOne({ name: "Alice", age: 30 })
assert.equal((await users.findById(inserted._id))?.name, "Alice")
assert.equal((await users.find({ age: { $gte: 18 } })).length, 1)
assert.equal((await users.updateOne(inserted._id, { age: 31 }))?.age, 31)
assert.equal((await users.findOne(inserted._id, { select: ["name"] as const }))?.name, "Alice")
assert.equal(await users.deleteOne(inserted._id), true)
assert.equal(await users.count({}), 0)
function rejectsWrongFieldType() {
  // @ts-expect-error - published types must reject a wrong field value
  return users.insertOne({ name: "Invalid", age: "old" })
}
void rejectsWrongFieldType
console.log("Consumer CRUD passed for stratadb@" + metadata.version)
`
  )
  await run(["bun", "install", "--production"], temporary)
  for (const version of ["6.0.3", "7.0.2"]) {
    await run(
      ["bunx", "-p", `typescript@${version}`, "tsc", "--noEmit"],
      temporary
    )
    console.log(`Consumer TypeScript ${version} passed with skipLibCheck:false`)
  }
  await run(["bun", "run", "consumer.ts"], temporary)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
