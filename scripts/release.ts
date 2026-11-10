import { existsSync } from "node:fs"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join, relative, resolve } from "node:path"

const STABLE_VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u
const SECTION = /^## /mu
const ARCHIVE_ENTRY =
  /^package\/(?:dist\/.*|src\/.*|README\.md|LICENSE|package\.json)$/u
const CI_PASS = /^RESULT: PASS$/mu

async function run(
  args: string[],
  cwd: string,
  capture = false
): Promise<string> {
  const process = Bun.spawn(args, {
    cwd,
    stdout: capture ? "pipe" : "inherit",
    stderr: "inherit",
  })
  const output = capture ? await new Response(process.stdout).text() : ""
  const code = await process.exited
  if (code !== 0) {
    throw new Error(
      `${args.join(" ")} exited ${code}${output ? `\n${output}` : ""}`
    )
  }
  return output.trimEnd()
}

function stableVersion(value: string): number[] {
  if (!STABLE_VERSION.test(value)) {
    throw new Error(`Invalid stable version: ${value}`)
  }
  const parts = value.split(".").map(Number)
  if (!parts.every(Number.isSafeInteger)) {
    throw new Error(`Invalid version: ${value}`)
  }
  return parts
}

function requireNewer(version: string, current: string): void {
  const next = stableVersion(version)
  const previous = stableVersion(current)
  for (let i = 0; i < 3; i += 1) {
    if ((next[i] ?? 0) > (previous[i] ?? 0)) {
      return
    }
    if ((next[i] ?? 0) < (previous[i] ?? 0)) {
      break
    }
  }
  throw new Error(`Release version ${version} must be greater than ${current}`)
}

function rollChangelog(changelog: string, version: string) {
  const marker = /^## \[Unreleased\][^\n]*\n/gmu
  const match = marker.exec(changelog)
  if (!match) {
    throw new Error("CHANGELOG.md is missing [Unreleased]")
  }
  const start = match.index + match[0].length
  const following = changelog.slice(start)
  const next = following.search(SECTION)
  const end = next === -1 ? changelog.length : start + next
  const entries = changelog.slice(start, end).trim()
  if (!entries.replace(/^#+[^\n]*$/gmu, "").trim()) {
    throw new Error("CHANGELOG.md [Unreleased] is empty")
  }
  const date = new Date().toISOString().slice(0, 10)
  return {
    entries,
    text: `${changelog.slice(0, start)}\n## [${version}] - ${date}\n\n${entries}\n\n${changelog.slice(end)}`,
  }
}

export function validateArchiveEntries(entries: string[]): void {
  const required = new Set([
    "package/dist/index.mjs",
    "package/dist/index.d.mts",
    "package/README.md",
    "package/LICENSE",
    "package/package.json",
  ])
  for (const entry of entries) {
    if (entry.split("/").includes("..") || !ARCHIVE_ENTRY.test(entry)) {
      throw new Error(`Unexpected tarball entry: ${entry}`)
    }
    required.delete(entry)
  }
  if (required.size > 0) {
    throw new Error(`Tarball missing: ${[...required].join(", ")}`)
  }
}

async function consumer(tarball: string, version: string): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "strata-release-consumer-"))
  try {
    await Bun.write(
      join(directory, "package.json"),
      JSON.stringify(
        {
          private: true,
          type: "module",
          dependencies: { stratadb: `file:${tarball}` },
        },
        null,
        2
      )
    )
    await Bun.write(
      join(directory, "consumer.ts"),
      `
import assert from "node:assert/strict"
import { Strata, createSchema } from "stratadb"
import metadata from "stratadb/package.json" with { type: "json" }
assert.equal(metadata.version, ${JSON.stringify(version)})
using db = new Strata({ database: ":memory:" })
const items = db.collection("items", createSchema().build())
const inserted = await items.insertOne({ name: "Émile", count: 1 })
assert.equal((await items.findById(inserted._id)).name, "Émile")
assert.equal((await items.updateOne(inserted._id, { count: 2 })).count, 2)
assert.equal(await items.deleteOne(inserted._id), true)
assert.equal(await items.count({}), 0)
console.log("Consumer CRUD passed for stratadb@" + metadata.version)
`
    )
    await run(["bun", "install", "--production"], directory)
    await run(["bun", "run", "consumer.ts"], directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

async function prepare(args: string[]): Promise<void> {
  const [version, ...options] = args
  if (!version) {
    throw new Error(
      "Usage: bun run release:prepare <version> [--dry-run] [--out <directory>]"
    )
  }
  stableVersion(version)
  let dryRun = false
  let destination: string | undefined
  for (let i = 0; i < options.length; i += 1) {
    const option = options[i]
    if (option === "--dry-run") {
      dryRun = true
    } else if (
      option === "--out" &&
      options[i + 1] &&
      !options[i + 1]?.startsWith("--")
    ) {
      destination = options[i + 1]
      i += 1
    } else {
      throw new Error(`Unknown or incomplete option: ${option}`)
    }
  }
  const root = await run(
    ["git", "rev-parse", "--show-toplevel"],
    process.cwd(),
    true
  )
  if (
    await run(
      ["git", "status", "--porcelain", "--untracked-files=all"],
      root,
      true
    )
  ) {
    throw new Error("Release preparation requires a clean working tree")
  }
  const metadata = await Bun.file(join(root, "package.json")).json()
  requireNewer(version, metadata.version)
  const branch = await run(["git", "branch", "--show-current"], root, true)
  if (branch !== `release/v${version}`) {
    throw new Error(
      `Expected branch release/v${version}, got ${branch || "detached HEAD"}`
    )
  }
  const tag = `v${version}`
  if (await run(["git", "tag", "--list", tag], root, true)) {
    throw new Error(`Tag ${tag} already exists`)
  }
  const out = resolve(
    destination ?? join(dirname(root), "StrataDb-release", tag)
  )
  if (existsSync(out)) {
    throw new Error(`Output directory already exists: ${out}`)
  }
  const fromRoot = relative(root, out)
  if (fromRoot === "" || (!fromRoot.startsWith("../") && fromRoot !== "..")) {
    throw new Error("Output worktree must be outside the source repository")
  }
  const changelog = rollChangelog(
    await Bun.file(join(root, "CHANGELOG.md")).text(),
    version
  )
  console.log(
    `Prepare ${metadata.version} -> ${version}: roll CHANGELOG, bump package.json, commit, tag ${tag}, run ci-local, pack/verify in ${out}`
  )
  if (dryRun) {
    console.log("Dry run: no files, commits, tags or worktrees written")
    return
  }
  metadata.version = version
  await Bun.write(
    join(root, "package.json"),
    `${JSON.stringify(metadata, null, 2)}\n`
  )
  await Bun.write(join(root, "CHANGELOG.md"), changelog.text)
  await run(["git", "add", "package.json", "CHANGELOG.md"], root)
  await run(["git", "commit", "-m", `chore(release): prepare ${tag}`], root)
  await run(["git", "tag", "-a", tag, "-m", `StrataDB ${tag}`], root)
  const ci = await run(["bash", "scripts/ci-local.sh", tag], root, true)
  console.log(ci)
  if (!CI_PASS.test(ci)) {
    throw new Error("ci-local did not report RESULT: PASS")
  }
  await run(["git", "worktree", "add", "--detach", out, tag], root)
  await Bun.write(join(out, "CI_LOCAL.log"), `${ci}\n`)
  await run(["bun", "install", "--frozen-lockfile"], out)
  await run(["bun", "run", "build"], out)
  await run(["bun", "pm", "pack"], out)
  const tarball = join(out, `stratadb-${version}.tgz`)
  const entries = (await run(["tar", "-tzf", tarball], out, true)).split("\n")
  validateArchiveEntries(entries)
  const digest = new Bun.CryptoHasher("sha512")
    .update(await readFile(tarball))
    .digest("hex")
  await Bun.write(join(out, "SHA512SUMS"), `${digest}  ${basename(tarball)}\n`)
  await consumer(tarball, version)
  await Bun.write(
    join(out, "RELEASE_NOTES.md"),
    `# ${tag}\n\n${changelog.entries}\n`
  )
  console.log(`Verified tarball: ${tarball}\nSHA-512: ${digest}`)
  console.log(
    `Maintainer commands:\ncd ${shellQuote(out)} && npm publish ./${basename(tarball)} --access public\nnpm view stratadb@${version} version\ngh release create ${tag} --verify-tag --title ${tag} --notes-file ${shellQuote(join(out, "RELEASE_NOTES.md"))}`
  )
}

if (import.meta.main) {
  try {
    await prepare(Bun.argv.slice(2))
  } catch (error) {
    console.error(
      `Release preparation failed: ${error instanceof Error ? error.message : String(error)}`
    )
    process.exitCode = 1
  }
}
