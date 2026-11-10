import { expect, test } from "bun:test"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { validateArchiveEntries } from "../../scripts/release.js"

const VERSION_ERROR = /version|greater/u
const ROLLED_CHANGELOG =
  /## \[Unreleased\]\n\n## \[98\.0\.0\] - \d{4}-\d{2}-\d{2}/u

const root = resolve(import.meta.dir, "../..")
const script = join(root, "scripts/release.ts")

function command(args: string[], cwd: string) {
  return Bun.spawnSync(args, { cwd, stdout: "pipe", stderr: "pipe" })
}
function git(cwd: string, ...args: string[]) {
  const result = command(["git", ...args], cwd)
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString())
  }
  return result.stdout.toString().trim()
}
async function fixture(run: (repo: string, out: string) => Promise<void>) {
  const temporary = mkdtempSync(join(tmpdir(), "strata-release-test-"))
  const repo = join(temporary, "repo")
  try {
    git(root, "clone", "--quiet", "--no-hardlinks", root, repo)
    git(repo, "config", "user.name", "Release Test")
    git(repo, "config", "user.email", "release-test@example.invalid")
    git(repo, "switch", "-C", "release/v98.0.0")
    writeFileSync(
      join(repo, "CHANGELOG.md"),
      "# Changelog\n\n## [Unreleased]\n\n### Breaking changes\n\n- Test migration.\n\n## [0.7.0] - 2026-11-10\n\n- Older.\n"
    )
    // CI is a fixture to avoid recursively running this integration test inside itself.
    // The actual repository CI gate is always run separately on real commits/tags.
    writeFileSync(
      join(repo, "scripts/ci-local.sh"),
      '#!/usr/bin/env bash\nset -eu\ngit rev-parse --verify "$1^{commit}"\necho "RESULT: PASS"\n'
    )
    git(repo, "add", "CHANGELOG.md", "scripts/ci-local.sh")
    git(repo, "commit", "-m", "test: release fixture")
    await run(repo, join(temporary, "artifacts"))
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}
async function release(repo: string, out: string, ...extra: string[]) {
  const process = Bun.spawn(["bun", script, "98.0.0", "--out", out, ...extra], {
    cwd: repo,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ])
  return { code, output: stdout + stderr }
}

test("[TASK-273] dry-run writes nothing and preflight rejects unsafe inputs", async () => {
  await fixture(async (repo, out) => {
    const before = git(repo, "rev-parse", "HEAD")
    const changelog = readFileSync(join(repo, "CHANGELOG.md"), "utf8")
    const dry = await release(repo, out, "--dry-run")
    expect(dry.code).toBe(0)
    expect(dry.output).toContain("98.0.0")
    expect(git(repo, "rev-parse", "HEAD")).toBe(before)
    expect(git(repo, "status", "--porcelain")).toBe("")
    expect(readFileSync(join(repo, "CHANGELOG.md"), "utf8")).toBe(changelog)
    expect(git(repo, "tag", "--list", "v98.0.0")).toBe("")
    expect(existsSync(out)).toBe(false)
    writeFileSync(join(repo, "dirty.txt"), "dirty")
    expect((await release(repo, out, "--dry-run")).output).toContain("clean")
    rmSync(join(repo, "dirty.txt"))
    mkdirSync(out)
    const existing = await release(repo, out, "--dry-run")
    expect(existing.code).not.toBe(0)
    expect(existing.output).toContain("already exists")
    rmSync(out, { recursive: true })
    git(repo, "switch", "-c", "wrong-branch")
    expect((await release(repo, out, "--dry-run")).output).toContain(
      "release/v98.0.0"
    )
    git(repo, "switch", "release/v98.0.0")
    git(repo, "tag", "v98.0.0")
    expect((await release(repo, out, "--dry-run")).output).toContain(
      "already exists"
    )
  })
}, 30_000)

test("[TASK-273] validates stable version ordering and nonempty Unreleased", async () => {
  await fixture(async (repo, out) => {
    for (const version of ["0.0.0", "0.7.0", "bad", "01.0.0", "98.0.0-beta"]) {
      const result = command(
        ["bun", script, version, "--out", out, "--dry-run"],
        repo
      )
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr.toString()).toMatch(VERSION_ERROR)
    }
    writeFileSync(
      join(repo, "CHANGELOG.md"),
      "# Changelog\n\n## [Unreleased]\n\n### Changed\n\n## [0.7.0]\n- Old\n"
    )
    git(repo, "add", "CHANGELOG.md")
    git(repo, "commit", "-m", "test: empty unreleased")
    expect((await release(repo, out, "--dry-run")).output).toContain("empty")
  })
}, 30_000)

test("[TASK-273] real clone run rolls changelog, tags, verifies pack and emits commands", async () => {
  await fixture(async (repo, out) => {
    const before = git(repo, "rev-parse", "HEAD")
    const hook = join(repo, ".git/hooks/pre-commit")
    writeFileSync(hook, "#!/bin/sh\necho ran > ../hook-ran\n")
    chmodSync(hook, 0o755)
    const result = await release(repo, out)
    expect(existsSync(join(repo, "../hook-ran"))).toBe(true)
    expect(result.output).toContain("RESULT: PASS")
    expect(result.code).toBe(0)
    expect(git(repo, "log", "-1", "--format=%s")).toBe(
      "chore(release): prepare v98.0.0"
    )
    expect(git(repo, "rev-parse", "HEAD^")).toBe(before)
    expect(git(repo, "cat-file", "-t", "v98.0.0")).toBe("tag")
    expect(git(repo, "rev-parse", "v98.0.0^{commit}")).toBe(
      git(repo, "rev-parse", "HEAD")
    )
    expect(
      JSON.parse(readFileSync(join(out, "package.json"), "utf8")).version
    ).toBe("98.0.0")
    expect(readFileSync(join(repo, "CHANGELOG.md"), "utf8")).toMatch(
      ROLLED_CHANGELOG
    )
    expect(readFileSync(join(out, "RELEASE_NOTES.md"), "utf8")).toContain(
      "Test migration."
    )
    expect(existsSync(join(out, "stratadb-98.0.0.tgz"))).toBe(true)
    const digest = new Bun.CryptoHasher("sha512")
      .update(readFileSync(join(out, "stratadb-98.0.0.tgz")))
      .digest("hex")
    expect(readFileSync(join(out, "SHA512SUMS"), "utf8")).toBe(
      `${digest}  stratadb-98.0.0.tgz\n`
    )
    expect(result.output).toContain("Consumer CRUD passed")
    expect(result.output).toContain(
      "npm publish ./stratadb-98.0.0.tgz --access public"
    )
    expect(git(repo, "status", "--porcelain")).toBe("")
    expect(git(repo, "ls-remote", "--heads", "origin", "release/v98.0.0")).toBe(
      ""
    )
  })
}, 120_000)

test("[TASK-273] failed CI stops before packaging", async () => {
  await fixture(async (repo, out) => {
    writeFileSync(
      join(repo, "scripts/ci-local.sh"),
      '#!/usr/bin/env bash\necho "RESULT: FAIL"\nexit 1\n'
    )
    git(repo, "add", "scripts/ci-local.sh")
    git(repo, "commit", "-m", "test: failing CI fixture")
    const result = await release(repo, out)
    expect(result.code).not.toBe(0)
    expect(result.output).toContain("RESULT: FAIL")
    expect(existsSync(out)).toBe(false)
  })
}, 30_000)

test("[TASK-273] archive validation rejects extra files, traversal and missing exports", () => {
  const valid = [
    "package/dist/index.mjs",
    "package/dist/index.d.mts",
    "package/README.md",
    "package/LICENSE",
    "package/package.json",
  ]
  expect(() => validateArchiveEntries(valid)).not.toThrow()
  for (const extra of [
    "package/.env",
    "package/test/secret.ts",
    "package/src/../../secret",
    "/etc/passwd",
  ]) {
    expect(() => validateArchiveEntries([...valid, extra])).toThrow(
      "Unexpected tarball entry"
    )
  }
  expect(() => validateArchiveEntries(valid.slice(1))).toThrow(
    "Tarball missing"
  )
})
