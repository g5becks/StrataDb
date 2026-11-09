#!/usr/bin/env bash
# =============================================================================
# StrataDB backlog population script, generated from stratadb-audit.md (2026-11-08)
#
# Creates 3 release milestones and 43 tasks with dependencies, labels,
# priorities, acceptance criteria and implementation guidance.
#
# Usage (from the StrataDb repo root, with stratadb-audit.md placed at the root):
#   bash scripts/stratadb-audit-backlog.sh
#   BACKLOG="bunx backlog.md" bash scripts/stratadb-audit-backlog.sh   # if `backlog` is not on PATH
#
# Conventions (matching StrataDb/CLAUDE.md):
#   - Tasks are created only through the Backlog.md CLI.
#   - Each task's Description holds Why + implementation guidance. `--plan` is left
#     empty on purpose: the implementing agent adds its own plan via
#     `backlog task edit <id> --plan ...` when it starts the task.
#   - Dependencies only reference tasks created earlier in this script.
#   - Labels map to work streams: deps, api, testing, performance, build-release.
#   - Release-prep tasks STOP before `npm publish` / `git push --tags`, so the
#     maintainer stays in control of publishing.
# =============================================================================
set -euo pipefail

BACKLOG="${BACKLOG:-backlog}"
AUDIT_DOC="stratadb-audit.md"

if [[ ! -f backlog/config.yml ]]; then
  echo "error: run this from the StrataDb repo root (backlog/config.yml not found)" >&2
  exit 1
fi
if [[ ! -f "$AUDIT_DOC" ]]; then
  echo "warning: $AUDIT_DOC not found at repo root; tasks reference it by section id" >&2
fi

# Guard: this script is a one-time population step. Re-running it would duplicate
# every task, so stop if the first task already exists.
# (Capture output first: `cmd | grep -q` under `set -o pipefail` reports failure
# when grep exits early and cmd gets SIGPIPE.)
EXISTING_TASKS="$($BACKLOG task list --plain 2>/dev/null || true)"
if [[ "$EXISTING_TASKS" == *"CI: add quality-gate workflow"* ]]; then
  echo "backlog already populated from $AUDIT_DOC (found the first audit task); nothing to do."
  exit 0
fi

# --- helpers -----------------------------------------------------------------
# mk <VAR> <title> [backlog task create options...]
# Creates a task and stores its id (e.g. TASK-214) in the shell variable <VAR>.
mk() {
  local __var="$1"; shift
  local __title="$1"; shift
  local __out __id
  __out="$($BACKLOG task create "$__title" "$@" --plain 2>&1)" || {
    echo "error creating task: $__title" >&2
    echo "$__out" >&2
    exit 1
  }
  __id="$(printf '%s\n' "$__out" | grep -oE '^Task TASK-[0-9]+' | head -1 | awk '{print $2}')"
  if [[ -z "$__id" ]]; then
    echo "error: could not parse task id for: $__title" >&2
    echo "$__out" >&2
    exit 1
  fi
  printf -v "$__var" '%s' "$__id"
  printf '  %-9s %s\n' "$__id" "$__title"
}

# milestone <name> <description>: create the milestone if it does not exist yet
milestone() {
  if $BACKLOG milestone list 2>/dev/null | grep -qF "$1"; then
    echo "  milestone exists: $1"
  else
    $BACKLOG milestone add "$1" -d "$2" >/dev/null
    echo "  milestone created: $1"
  fi
}

# Shared acceptance criteria used by every code task
AC_GREEN="bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI"
AC_CHANGELOG="CHANGELOG.md has an entry under ## [Unreleased] describing the change"

M1="v0.5.1 Guardrails"
M2="v0.6.0 Safety and Correctness"
M3="v0.7.0 DX and Performance"

echo "== Milestones"
milestone "$M1" "Non-breaking: CI, TypeScript 7 toolchain, Bun 1.4 fixes, packaging. See $AUDIT_DOC section 5 Phase 0."
milestone "$M2" "Breaking (documented): SQL injection, strict operators, atomic writes, transactions, retries, indexes, semantics. See $AUDIT_DOC section 5 Phase 1."
milestone "$M3" "Additive: schema evolution, events, typed APIs, performance, cleanup. See $AUDIT_DOC section 5 Phases 2-3."

# =============================================================================
# MILESTONE 1: v0.5.1 Guardrails
# =============================================================================
echo "== $M1"

# --- build-release: CI ---------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
There is no CI for tests, lint or typecheck: only `deploy-docs.yml` exists, and the lefthook pre-push test hook is commented out. Every later task relies on CI to self-validate. Audit refs: Q2, C8, C11 (stratadb-audit.md).

## Implementation
1. Add `.github/workflows/ci.yml`, triggered on push and pull_request to main.
2. Job `check` on ubuntu-latest and macos-latest (macOS uses the system SQLite; audit 1B-B3):
   - `oven-sh/setup-bun` pinned to an exact version (current: 1.4.4), plus a second matrix entry for the latest Bun;
   - `bun install --frozen-lockfile`;
   - `bun run typecheck`, `bun run lint`, `bun test --coverage`, `bun run build`, `bun run test:types`.
3. Pin all GitHub Actions by commit SHA (keep version comments).
4. Pin `bun-version` in `deploy-docs.yml` (no `latest`).
5. lefthook: enable the pre-push `bun test` command (remove the TODO comment).
6. package.json: change `prepare` to `lefthook install` only. Checks belong in CI, not in install.

## Out of scope
TypeScript version matrix (added by a later task).
EOF
mk T_CI "CI: add quality-gate workflow (typecheck, lint, test, build) on Linux and macOS" \
  -d "$D" -l build-release -m "$M1" --priority High --type chore --doc "$AUDIT_DOC" \
  --ac ".github/workflows/ci.yml runs typecheck, lint, bun test --coverage, build and type tests on ubuntu-latest and macos-latest for a pinned Bun version and the latest Bun" \
  --ac "All third-party actions in .github/workflows/*.yml are pinned by commit SHA" \
  --ac "deploy-docs.yml no longer uses bun-version: latest" \
  --ac "lefthook pre-push runs bun test; package.json prepare script is only 'lefthook install'" \
  --ac "The workflow runs green on a PR branch (the 2 known removeAllListeners failures are fixed in a separate task; until then they may be marked test.failing with a reference to that task)"

# --- api: removeAllListeners -----------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
`collection.removeAllListeners()` with no argument removes nothing on Bun >= 1.4. The implementation forwards `undefined` explicitly (`this._emitter.removeAllListeners(event)` in src/sqlite-collection.ts ~2184), and Node-compatible EventEmitter treats an explicit `undefined` as an event name. This causes the 2 failing tests in test/unit/collection-events.test.ts. Verified: the tests pass on Bun 1.3.6 and fail on 1.4.4. Audit refs: A18, 1B-B1.

## Implementation
1. In `removeAllListeners(event?)`: if `event === undefined`, call `this._emitter.removeAllListeners()` with no args; otherwise pass the event.
2. Search src/ for other EventEmitter calls that forward optional args and fix them the same way.
3. Add a regression test: register listeners on 2 events, call `removeAllListeners()`, and assert `listenerCount` is 0 for both.
EOF
mk T_RAL "Fix removeAllListeners() with no argument (Bun 1.4 EventEmitter semantics)" \
  -d "$D" -l api -m "$M1" --priority High --type bug --doc "$AUDIT_DOC" \
  --ref "src/sqlite-collection.ts" --ref "test/unit/collection-events.test.ts" \
  --ac "collection.removeAllListeners() with no argument removes listeners for every event (new regression test)" \
  --ac "The 2 previously failing tests in test/unit/collection-events.test.ts pass on Bun 1.4.4" \
  --ac "bun test reports 0 failures" \
  --ac "$AC_CHANGELOG"

# --- deps: TS types baseline ------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
TypeScript 6 and 7 default `compilerOptions.types` to `[]`, so bun-types is no longer loaded automatically. `tsc` 6.0.3 and 7.0.2 both report 56 errors, and 0 with `--types bun`. `@types/bun` is pinned to `latest` (lockfile 1.3.2). With TS 7 and `skipLibCheck: false`, bun-types 1.4.4 also needs `@types/node` >= 26 (the stale transitive 24.10.1 fails on KeyObject/TLSSocket). Audit refs: D2, D4, 1A.

## Implementation
1. tsconfig.json: add `"types": ["bun"]`.
2. package.json devDependencies: `@types/bun` pinned to `1.4.4` (exact), add `@types/node` `^26`.
3. `bun install`, then commit bun.lock.
4. Verify locally: `bunx -p typescript@6.0.3 tsc --noEmit` and `bunx -p typescript@7.0.2 tsc --noEmit` both report 0 errors.
EOF
mk T_TYPES "Toolchain: add types:[bun] and pin @types/bun 1.4.4 + @types/node ^26" \
  -d "$D" -l deps -m "$M1" --priority High --type chore --doc "$AUDIT_DOC" --dep "$T_CI" \
  --ac "tsconfig.json contains \"types\": [\"bun\"]" \
  --ac "package.json pins @types/bun to an exact version (1.4.4) and declares @types/node ^26; bun.lock updated" \
  --ac "tsc --noEmit reports 0 errors with TypeScript 5.9.x, 6.0.x and 7.0.x" \
  --ac "$AC_GREEN"

# --- deps/build: tsdown 0.23 + oxc dts ---------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
tsdown 0.16.6 crashes on TypeScript 7 (no classic compiler API). tsdown 0.23.7 (rolldown-plugin-dts 0.30) supports TS 7, and its `oxc` declaration generator does not depend on the TS version. The tsgo generator is deprecated on TS 7.0. The upgrade also inlines type-fest types (fixes audit D1). Building with platform "neutral" changes output names to .js/.d.ts, so either use `fixedExtension: true` or update package.json fields. Audit refs: D1, D4, D5, 1A.

## Implementation
1. Upgrade tsdown to ^0.23.7.
2. tsdown.config.ts:
   - `dts: { generator: "oxc" }`;
   - replace the deprecated `external` with `deps: { neverBundle: ["bun:sqlite"] }`;
   - set `platform: "neutral"` (the library is Bun-only) and a modern target;
   - keep output names (`fixedExtension: true`) so `dist/index.mjs` and `dist/index.d.mts` stay unchanged.
3. tsconfig.json: enable `"isolatedDeclarations": true`, and add an explicit type annotation to `deepMerge` in src/deep-merge.ts (~line 70); it is the only TS9010 error.
4. Decide on `type-fest`: keep it inlined in the .d.ts (default) or move it to dependencies. Document the choice in CHANGELOG.
5. Verify that `bun run build` emits no warnings and dist/index.d.mts has no `from "type-fest"` import (if inlining).

## Out of scope
Switching the dev TypeScript version (next task).
EOF
mk T_TSDOWN "Build: upgrade tsdown to 0.23 with oxc declarations and isolatedDeclarations" \
  -d "$D" -l deps,build-release -m "$M1" --priority High --type chore --doc "$AUDIT_DOC" --dep "$T_TYPES" \
  --ref "tsdown.config.ts" --ref "src/deep-merge.ts" \
  --ac "tsdown is ^0.23.x and bun run build completes with no deprecation warnings" \
  --ac "dist/ still contains index.mjs and index.d.mts (package.json main/types/exports unchanged)" \
  --ac "isolatedDeclarations is enabled and tsc reports 0 errors" \
  --ac "dist/index.d.mts does not import from type-fest, or type-fest is listed in dependencies (choice recorded in CHANGELOG)" \
  --ac "$AC_GREEN"

# --- deps: TypeScript 7 ------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
agentx (the main consumer) is moving to TypeScript 7. StrataDB must develop and test against TS 7.0.x while still serving TS 5.9/6.0 consumers. Audit ref: 1A.

## Implementation
1. devDependencies: `typescript` ~7.0.2. Update the `typecheck` script if needed (TS 7 ships `tsc`).
2. CI: add a typecheck matrix job: TS 7.0.x (blocking), 6.0.x (blocking), 5.9.x (blocking), 7.1 beta/next (continue-on-error). Use `bunx -p typescript@<v> tsc --noEmit`.
3. Make sure nothing else in the toolchain imports the `typescript` JS API under TS 7 (typedoc and tsd are handled by separate tasks; keep `docs:build` and `test:types` working, temporarily pinning them to TS 5.9/6 if needed).
EOF
mk T_TS7 "Toolchain: develop on TypeScript 7.0 with a TS 5.9/6.0/7.0 CI matrix" \
  -d "$D" -l deps -m "$M1" --priority High --type chore --doc "$AUDIT_DOC" --dep "$T_TSDOWN" \
  --ac "package.json devDependencies use typescript ~7.0.x and bun run typecheck passes" \
  --ac "CI runs tsc --noEmit on TypeScript 7.0.x, 6.0.x and 5.9.x (all blocking) and on TS 7.1 beta/next (non-blocking)" \
  --ac "bun run build, bun run docs:build and bun run test:types still succeed" \
  --ac "$AC_GREEN"

# --- testing: replace tsd ---------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
tsd bundles its own TypeScript 5.9.3, so type tests never exercise TS 6/7, and `test:types` requires a full build. Audit refs: Q1, Q6, 1A.

## Implementation
1. Add `expect-type` as a devDependency.
2. Port each file in test/type/*.test-d.ts to `expectTypeOf(...)` / `// @ts-expect-error` assertions importing from `../../src/index.ts`, with no build step.
3. Add a tsconfig for type tests (or include them in the main typecheck) so `tsc --noEmit` checks them on every CI TS version.
4. Remove `tsd` and the `tsd` package.json field; make `test:types` run the new check.
EOF
mk T_TYPETESTS "Testing: replace tsd with expect-type checked by the project tsc" \
  -d "$D" -l testing -m "$M1" --priority Medium --type chore --doc "$AUDIT_DOC" --dep "$T_TS7" \
  --ac "tsd is removed from package.json (devDependency and config field)" \
  --ac "All assertions previously in test/type/*.test-d.ts exist as expect-type or @ts-expect-error assertions and pass" \
  --ac "Type tests run without a prior build and run on every TypeScript version in the CI matrix" \
  --ac "Deliberately breaking one assertion makes bun run test:types fail (verified once locally)" \
  --ac "$AC_GREEN"

# --- build-release: docs on TS 6 -------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
TypeDoc 0.28.x (latest 0.28.20) supports TypeScript only up to 6.0 and crashes on TS 7 ("Cannot read properties of undefined (reading 'PropertyDeclaration')"). TypeDoc imports `typescript` by name, so installing an alias package next to TS 7 is not enough. Audit ref: 1A item 4.

## Implementation
1. Create a small docs workspace (e.g. `docs/package.json`) with its own `typescript@~6.0`, `typedoc`, `typedoc-plugin-markdown`, `typedoc-vitepress-theme`, `vitepress`.
2. Point `docs:build` and `docs:dev` at that workspace (TypeDoc runs from it, reading ../src).
3. Keep `deploy-docs.yml` working (install both workspaces).
4. Add a code comment and a tracking note (GitHub issue or CHANGELOG line) to fold it back once TypeDoc supports TS 7.
EOF
mk T_DOCS_TS6 "Build: run TypeDoc/VitePress docs build from a TS 6 docs workspace" \
  -d "$D" -l build-release -m "$M1" --priority Medium --type chore --doc "$AUDIT_DOC" --dep "$T_TS7" \
  --ac "bun run docs:build succeeds with root typescript 7.x installed and regenerates docs/api" \
  --ac "deploy-docs.yml succeeds on a test branch or with workflow_dispatch" \
  --ac "The root package no longer needs typedoc/vitepress devDependencies (moved to the docs workspace)"

# --- build-release: package metadata ----------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
package.json has no license, repository, homepage, bugs, keywords, engines or sideEffects fields. Source maps reference ../src, which is not published. There are no git tags for any release. Audit refs: D1, D6.

## Implementation
1. Add `license` (match the LICENSE file), `repository` (git+https://github.com/g5becks/StrataDb.git), `homepage`, `bugs`, `keywords`, `"sideEffects": false`.
2. Add `"engines": { "bun": ">=1.3.14" }` for v0.5.1. It is raised to >=1.4.4 in v0.6.0 by a later task.
3. Source maps: either add `src` to `files`, or disable `declarationMap`/`sourcemap` in tsdown. Pick one and verify that "go to definition" works or is consistently absent.
4. Add `"./package.json": "./package.json"` to exports.
5. Verify with `bun pm pack --dry-run` (contents list).
EOF
mk T_META "Build: complete package.json metadata, engines field and source-map strategy" \
  -d "$D" -l build-release -m "$M1" --priority Medium --type chore --doc "$AUDIT_DOC" --dep "$T_TSDOWN" \
  --ac "package.json has license, repository, homepage, bugs, keywords, sideEffects:false and engines.bun >=1.3.14" \
  --ac "The packed tarball either includes src/ for source maps or ships no .map files referencing missing sources" \
  --ac "exports includes ./package.json" \
  --ac "$AC_GREEN"

# --- testing: consumer smoke test --------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
Publishing defects (types depending on devDependencies, missing files, TS-version incompatibilities) are invisible to in-repo tests. Audit refs: Q8, D1, 1A.

## Implementation
1. Add `scripts/smoke-consumer.ts` (or a CI job) that:
   1. runs `bun pm pack` into a temp dir;
   2. creates a temp fixture project with only production deps installed from the tarball (plus @types/bun, @types/node);
   3. writes a fixture that imports `Strata`, `createSchema`, `Document`, runs insert/find/update/delete on `:memory:`, and includes a `// @ts-expect-error` asserting a wrong field type is rejected;
   4. typechecks it with TypeScript 7.0.x and 6.0.x under `skipLibCheck: false`;
   5. runs it with Bun.
2. Run it in CI after build.
EOF
mk T_SMOKE "Testing: add packed-tarball consumer smoke test (TS 6/7, skipLibCheck false)" \
  -d "$D" -l testing,build-release -m "$M1" --priority Medium --type chore --doc "$AUDIT_DOC" --dep "$T_META" --dep "$T_TS7" \
  --ac "A CI job packs the library, installs it into a fixture with production deps only, and typechecks the fixture on TS 7.0 and 6.0 with skipLibCheck false" \
  --ac "The fixture executes CRUD against :memory: under Bun and exits 0" \
  --ac "Removing a runtime dependency from package.json makes the smoke job fail (verified once locally)"

# --- api: retry classification --------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
Automatic retries never fire on real SQLite lock errors. `isRetryableError` (src/retry-utils.ts ~69) checks `typeof error.code === "number"`, but Bun's SQLiteError has `code: "SQLITE_BUSY"` (a string) and `errno: 5` (extended codes such as 517 exist too). ConnectionError and TransactionError are never thrown. The unit tests fake `{ code: 5 }` and mask the bug. This has been wrong since Bun 1.0.21; it is not a regression. Audit refs: A7, 1B-B1.

## Implementation
1. Classify by primary result code: `(error.errno & 0xff)` in {5 BUSY, 6 LOCKED, 10 IOERR} (decide on 7 NOMEM).
2. Keep the existing instanceof checks for StrataDB error classes.
3. Replace the fake-code unit tests with tests built from real `SQLiteError` instances.
4. Add an integration test: two `Database` handles on one temp file; handle A holds `BEGIN IMMEDIATE`; a collection op through handle B (retry enabled, busy_timeout=0) retries; release the lock from a timer; assert success after retry. Also assert failure with retries disabled.
EOF
mk T_RETRY "Fix retry classification to use SQLite errno (retries currently never fire)" \
  -d "$D" -l api -m "$M1" --priority High --type bug --doc "$AUDIT_DOC" --dep "$T_RAL" \
  --ref "src/retry-utils.ts" --ref "test/unit/retry-utils.test.ts" \
  --ac "isRetryableError returns true for real Bun SQLiteError instances with errno 5, 6, 10 and extended codes whose low byte is 5/6 (e.g. 517)" \
  --ac "Unit tests no longer fabricate numeric code properties; they use real SQLiteError objects" \
  --ac "A two-connection integration test proves a SQLITE_BUSY failure is retried and succeeds once the lock is released" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- api: SQLite version guard ------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
StrataDB requires SQLite >= 3.45 (jsonb functions). On macOS, Bun loads the system libsqlite3, so the version depends on the OS. Older macOS releases fail with an obscure "no such function: jsonb_extract". Audit ref: 1B-B3.

## Implementation
1. In the `Strata` constructor, run `select sqlite_version()` once and compare it semver-wise against 3.45.0.
2. If it is too old, throw a `ConnectionError` (it exists in src/errors.ts) naming the found version, the required version, and `Database.setCustomSQLite()` as the macOS remedy.
3. Unit-test it by injecting a database whose version query returns an old version (wrap or stub `query`).
4. Document the requirement in README (Installation section).
EOF
mk T_SQLITEVER "Add SQLite >= 3.45 version guard with a macOS remedy message" \
  -d "$D" -l api -m "$M1" --priority Medium --type enhancement --doc "$AUDIT_DOC" --dep "$T_RAL" \
  --ref "src/stratadb.ts" \
  --ac "new Strata() throws ConnectionError mentioning the found version, 3.45.0 and Database.setCustomSQLite() when sqlite_version() < 3.45.0 (unit test with stubbed version)" \
  --ac "No behavior change on SQLite >= 3.45 (existing tests pass)" \
  --ac "README documents the SQLite >= 3.45 requirement and the macOS remedy" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- api: Bun 1.4 behavior fixes ------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
Bun 1.4.x changed several bun:sqlite behaviors (audit 1B-B1):
- binding a Date/Map/Promise now throws TypeError instead of binding NULL. The `$index` operator pushes `condition` without `toBindValue` (src/sqlite-query-translator.ts ~935), so a raw TypeError leaks (and on Bun 1.3 a silent NULL was bound);
- `db.close()` now finalizes every cached statement, so using a collection after `close()` throws a confusing "Statement has finalized".

## Implementation
1. Route every value bound by the translator (including `$index` conditions) through `toBindValue` so unsupported types raise QueryError consistently.
2. Track closed state in Strata/collections; any operation after `close()` rejects with a StrataDB error (e.g. ConnectionError "database is closed").
3. Add tests for both. Document the `changes` counting change (trigger/cascade rows no longer counted on Bun 1.4.4) in the docs.
EOF
mk T_BUN14 "Handle Bun 1.4 bun:sqlite behavior changes (bind validation, use-after-close)" \
  -d "$D" -l api -m "$M1" --priority Medium --type bug --doc "$AUDIT_DOC" --dep "$T_RAL" \
  --ref "src/sqlite-query-translator.ts" --ref "src/stratadb.ts" \
  --ac "find({ tags: { \$index: { index: 0, condition: new Date() } } }) rejects with QueryError (not TypeError) on Bun 1.4.4" \
  --ac "Calling any collection method after db.close() rejects with a StrataDB error class whose message says the database is closed" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- build-release: v0.5.1 prep -----------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
Package the non-breaking guardrail work as v0.5.1. Publishing is done by the maintainer.

## Implementation
1. Move the CHANGELOG `[Unreleased]` entries to `## [0.5.1] - <date>`.
2. Bump package.json to 0.5.1.
3. Run the full verification: typecheck (TS 5.9/6/7), lint, test, build, type tests, consumer smoke, `bun pm pack --dry-run`.
4. Create a local annotated tag `v0.5.1` **without pushing**, plus the retroactive tag `v0.5.0` on the commit that published 0.5.0 (find it via CHANGELOG/git log). Do not push.
5. STOP. Leave the task in "In Progress" with notes listing the exact publish commands for the maintainer (`git push --tags`, `npm publish --provenance`).

## Not allowed
`npm publish`, `git push --tags`.
EOF
mk T_REL051 "Release prep: v0.5.1 (verify, changelog, local tag; do not publish)" \
  -d "$D" -l build-release -m "$M1" --priority Medium --type chore --doc "$AUDIT_DOC" \
  --dep "$T_CI" --dep "$T_RAL" --dep "$T_TYPES" --dep "$T_TSDOWN" --dep "$T_TS7" --dep "$T_TYPETESTS" \
  --dep "$T_DOCS_TS6" --dep "$T_META" --dep "$T_SMOKE" --dep "$T_RETRY" --dep "$T_SQLITEVER" --dep "$T_BUN14" \
  --ac "CHANGELOG.md has a [0.5.1] section covering every task in this milestone" \
  --ac "package.json version is 0.5.1 and all verification commands pass" \
  --ac "Local tags v0.5.0 (retroactive) and v0.5.1 exist; nothing is pushed or published" \
  --ac "Task notes contain the exact publish commands for the maintainer"

# =============================================================================
# MILESTONE 2: v0.6.0 Safety and Correctness (breaking, documented)
# =============================================================================
echo "== $M2"

# --- testing: audit regression suite first -------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
Every v0.6.0 fix must be self-validating. Encode the audit's Appendix A repros as tests first, marked `test.failing` (Bun) so CI stays green. Each fix task flips its cases to plain `test`. Audit refs: Appendix A, Q3.

## Implementation
1. Create `test/regression/audit-2026-11.test.ts` (split per area if large) with one `test.failing(...)` per repro, named with its audit id, e.g. "A1 injection via filter key returns no rows".
   - A1: filter-key injection; `$index` injection; `limit` injection.
   - A2: `deleteMany({ role: { $eqq: "admin" } })` must throw and delete 0 rows.
   - A3: concurrent conditional updateOne: exactly one winner; concurrent updates of different fields: no lost update.
   - A4: deleteMany/updateMany inside db.execute(); an outside write during a pending execute() survives its rollback; no events for rolled-back writes.
   - A5: async methods never throw synchronously (retries off).
   - A6: a throwing listener does not fail a committed write.
   - A8: compoundIndex creates an index; a unique compound rejects duplicates.
   - A9: timestamps(false) omits createdAt/updatedAt.
   - A10: reopening with a new indexed field can query it.
   - A11: null equality and $ne semantics.
   - A12: $elemMatch on object arrays.
   - A13: $like case, wildcard escaping, search caseSensitive.
   - A14: skip without limit.
   - A15: unknown cursor id errors.
   - A16: collection names "order" and "user-data".
   - A17: DeleteEvent carries _id; deleteMany emits ids.
2. Each test asserts the **correct** behavior described in the audit, so it fails today.
3. Add a README note in test/regression explaining the flip-to-`test` convention.
EOF
mk T_REGR "Testing: encode audit Appendix A repros as test.failing regression suite" \
  -d "$D" -l testing -m "$M2" --priority High --type chore --doc "$AUDIT_DOC" --dep "$T_REL051" \
  --ac "test/regression/ contains one test.failing case per audit repro A1-A17 listed in the description, each named with its audit id" \
  --ac "Every case asserts the correct (post-fix) behavior and currently fails; bun test is green because they are marked test.failing" \
  --ac "test/regression/README.md documents that fix tasks must convert their cases from test.failing to test"

# --- api: FieldResolver / injection ---------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
**SQL injection (Critical).** Field names are interpolated into SQL in 5 places: translator `resolveFieldName`; collection `buildSearchClause`, `buildSortClause`, `buildCursorClause`; and `createTable`/`createIndexes` DDL. `$index.index`, `limit` and `skip` are interpolated too (find() bypasses `translateOptions`). Repros: a crafted filter key and a crafted `$index` both returned all rows. Audit refs: A1, A16, C1, C2.

## Implementation
1. Add `src/field-resolver.ts`:
   - `resolveField(name, schema)` validates each path segment against `^[A-Za-z_][A-Za-z0-9_]*$` (QueryError otherwise);
   - returns either a quoted generated-column identifier (`"_name"`) or `jsonb_extract(body, ?)` with the JSON path as a bound parameter;
   - helpers `quoteIdent()` (double quotes, escape `"` as `""`) and `assertNonNegativeInt()`.
2. Use it in all 5 SQL builders, and in DDL for table, column and index names.
3. `limit`, `skip` and `$index.index`: validate with `Number.isSafeInteger(x) && x >= 0` and bind as parameters.
4. Remove `translateOptions()` or make find() use it, so only one options path remains.
5. Validate collection names at `db.collection()` (allow any name, but quote it everywhere; reject empty names).
6. Map dotted indexed fields to safe column names (e.g. `_profile__city`).
7. Flip regression cases A1 and A16 to `test`. Add an injection corpus test covering filter keys, sort keys, search fields, `$index`, limit and skip.
EOF
mk T_FIELDRES "Security: single FieldResolver with identifier validation, quoting and bound params" \
  -d "$D" -l api -m "$M2" --priority High --type bug --doc "$AUDIT_DOC" --dep "$T_REGR" \
  --ref "src/sqlite-query-translator.ts" --ref "src/sqlite-collection.ts" \
  --ac "All SQL identifiers and JSON paths are produced by one module; grep finds no template-literal interpolation of field names, limit, skip or \$index into SQL in src/" \
  --ac "Regression cases A1 (filter key, \$index, limit injection) and A16 (collections named order and user-data) pass as normal tests" \
  --ac "An injection corpus test over filter keys, sort keys, search fields, \$index, limit and skip asserts QueryError and never returns extra rows" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG (Breaking changes section)"

# --- api: strict operators ----------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
**Data loss (Critical).** Unknown operators are silently ignored (`default: return null` in `translateSingleOperator`), so the condition disappears and the filter matches everything. Repro: `deleteMany({ role: { $eqq: "admin" } })` deleted every row. `InvalidQueryOperatorError` exists but is never thrown. Audit ref: A2.

## Implementation
1. Throw `InvalidQueryOperatorError` for any unrecognized `$`-prefixed key, at any nesting level (field operators, `$elemMatch`, `$index`, logical operators).
2. Validate operator value shapes: `$in`/`$nin`/`$all` take arrays; `$size` takes a non-negative integer; `$exists` takes a boolean; LIKE-family operators take strings.
3. Optional safety: `deleteMany({})` requires `{ all: true }` in options. Record the decision in CHANGELOG.
4. Flip regression case A2.
EOF
mk T_STRICTOPS "Safety: reject unknown query operators and malformed operator values" \
  -d "$D" -l api -m "$M2" --priority High --type bug --doc "$AUDIT_DOC" --dep "$T_FIELDRES" \
  --ac "Every query method (find, findOne, count, updateMany, deleteMany, findOneAnd*) rejects an unknown \$operator with InvalidQueryOperatorError" \
  --ac "Regression case A2 passes: deleteMany with \$eqq throws and deletes 0 rows" \
  --ac "Malformed operator values (e.g. \$in with a string) reject with QueryError (tests for each operator)" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG (Breaking changes section)"

# --- api: promise-only errors ---------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
With retries off (the default), `withRetry` returns `operation()` directly. Synchronous throws (SQL errors, validation, listener errors) escape from Promise-returning methods, so `c.find(x).catch(...)` crashes the process. With retries on, the same error becomes a rejection, so dev and prod behave differently. Audit ref: A5.

## Implementation
1. Make every public async method `async`, or wrap the operation with `Promise.try`.
2. Make `withRetry` always return a promise that rejects (never throws synchronously).
3. Add a contract test that iterates over every public async method of Collection and Strata (insertOne, insertMany, find, findOne, findById, count, search, updateOne, updateMany, replaceOne, deleteOne, deleteMany, findOneAnd*, drop, execute, ...) with bad input and asserts that a promise is returned and rejects, with retries both on and off.
4. Flip regression case A5.
EOF
mk T_PROMISE "Correctness: async methods always reject instead of throwing synchronously" \
  -d "$D" -l api -m "$M2" --priority High --type bug --doc "$AUDIT_DOC" --dep "$T_REGR" \
  --ref "src/retry-utils.ts" --ref "src/sqlite-collection.ts" \
  --ac "A contract test covers every public async method of Strata and Collection and proves none throws synchronously (retries on and off)" \
  --ac "Regression case A5 passes" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG (Breaking changes section)"

# --- api: atomic single-doc writes ---------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
**Race condition (Critical).** `updateOne` runs `await findOne()`, merges in JS, then `UPDATE ... WHERE _id = ?`, and other async callers interleave in between. Repro: two concurrent conditional updateOne calls (CAS pending to running) both succeed, and concurrent updates of different fields lose one. agentx's trade-jobs `transition()` relies on this as a compare-and-swap. replaceOne and findOneAnd* share the pattern. updateOne also writes `updatedAt` into the JSON body. Audit refs: A3, P4, A9.

## Implementation
1. Make each single-document write either one SQL statement or a synchronous `db.transaction()` with no await between read and write:
   - preferred: `UPDATE t SET body = jsonb(?), updatedAt = ? WHERE _id = (SELECT _id FROM t WHERE <filter> LIMIT 1) AND <filter> RETURNING _id, json(body)`, with the merge computed inside a synchronous transaction that re-reads the row;
   - or `jsonb_patch`, but only if its RFC 7396 semantics (null deletes keys) are accepted and documented.
2. Apply to updateOne, replaceOne, findOneAndUpdate, findOneAndReplace, findOneAndDelete; upsert must be atomic too (INSERT ... ON CONFLICT or a sync transaction).
3. Stop writing `_id`/`createdAt`/`updatedAt` into the JSON body.
4. Flip regression case A3 (both variants).
EOF
mk T_ATOMIC "Correctness: make updateOne/replaceOne/findOneAnd* atomic (no CAS races, no lost updates)" \
  -d "$D" -l api -m "$M2" --priority High --type bug --doc "$AUDIT_DOC" --dep "$T_FIELDRES" --dep "$T_PROMISE" \
  --ref "src/sqlite-collection.ts" \
  --ac "Regression case A3 passes: of two concurrent conditional updateOne calls exactly one returns a document; concurrent updates to different fields both persist" \
  --ac "The same concurrency tests pass for replaceOne and findOneAndUpdate; upsert under concurrency creates exactly one document" \
  --ac "Stored JSON bodies no longer contain createdAt/updatedAt/_id (test reads raw body)" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- api: transactions ----------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
updateMany and deleteMany issue their own `BEGIN TRANSACTION`, so they fail inside `db.execute()` ("cannot start a transaction within a transaction"). `execute()` awaits user code inside BEGIN, so unrelated concurrent writes join the transaction and are rolled back with it. Events fire for writes that are later rolled back. Bun note: `db.transaction()` is synchronous-only. Audit refs: A4, P5, 1B-B1.

## Implementation
1. Add an internal transaction manager with depth tracking: the outermost level uses BEGIN/COMMIT/ROLLBACK, nested levels use `SAVEPOINT sp_n` / `RELEASE` / `ROLLBACK TO`.
2. updateMany, deleteMany, insertMany and drop use the manager (savepoint when nested).
3. `execute()` is serialized behind an async mutex. Writes issued outside an active execute() wait for it to finish rather than joining it. Document this.
4. Buffer events during a transaction; flush on the outermost commit, drop on rollback.
5. `transaction().collection(name, schema, options)` forwards options.
6. Flip regression case A4 (all variants).
EOF
mk T_TX "Correctness: nest-safe transactions, serialized execute() and buffered events" \
  -d "$D" -l api -m "$M2" --priority High --type bug --doc "$AUDIT_DOC" --dep "$T_PROMISE" --dep "$T_ATOMIC" \
  --ref "src/stratadb.ts" --ref "src/sqlite-collection.ts" \
  --ac "Every write method works inside db.execute(), and nested execute() calls commit/roll back independently via savepoints (tests)" \
  --ac "Regression case A4 passes: an outside write during a pending execute() survives that execute()'s rollback" \
  --ac "No collection events are emitted for writes that are rolled back; events for committed writes are emitted after commit (tests)" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG (Breaking changes section)"

# --- api: listener isolation ------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
A throwing event listener makes a write whose row is already committed report failure, so retry wrappers may duplicate it. Audit ref: A6.

## Implementation
1. In `emitEvent`, invoke listeners so that their exceptions never propagate into the write operation. Catch them and route them to an `'error'` collection event or a `Strata` option `onListenerError(err, event)`; default to `console.error` with event context.
2. Define and document the delivery guarantees: after commit (per the transactions task), synchronous, in registration order, at-most-once.
3. Flip regression case A6.
EOF
mk T_LISTENERS "Correctness: isolate event listener errors from write operations" \
  -d "$D" -l api -m "$M2" --priority Medium --type bug --doc "$AUDIT_DOC" --dep "$T_TX" \
  --ac "Regression case A6 passes: a throwing insert listener does not make insertOne reject; the row is committed" \
  --ac "Listener errors are delivered to onListenerError or an error event (test for each path)" \
  --ac "Event delivery guarantees are documented in docs/guide (events page)" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- api: error mapping boundary --------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
7 of 12 exported error classes are never thrown. Raw Bun SQLiteError (syntax, missing column, lock) leaks to callers. errors.ts has 63.6% coverage. Bun < 1.4 leaves `code` undefined for generic errors, so mapping must use errno. Audit refs: A19, 1B-B1.

## Implementation
1. Add `wrapSqliteError(err, ctx: { sql?, collection?, operation? })`, mapping by `errno & 0xff`:
   - BUSY/LOCKED → ConnectionError or TransactionError (retryable);
   - CONSTRAINT_UNIQUE/PRIMARYKEY → UniqueConstraintError;
   - other CONSTRAINT_* → ConstraintError;
   - ERROR → QueryError.
   Attach errno, code and context.
2. Wrap at every place statements run (prepare/run/all/get/exec).
3. For each exported class, either throw it in a real path or mark it `@deprecated` (do not remove in 0.6.0).
4. Ensure the retry classifier from the earlier retry task still recognizes wrapped errors.
5. Tests: one per mapping, plus errors.ts coverage >= 90%.
EOF
mk T_ERRMAP "Errors: map all SQLiteErrors to StrataDB error classes at one boundary" \
  -d "$D" -l api -m "$M2" --priority Medium --type enhancement --doc "$AUDIT_DOC" --dep "$T_RETRY" --dep "$T_PROMISE" \
  --ref "src/errors.ts" \
  --ac "No raw bun:sqlite SQLiteError escapes a public API call (tests for syntax error, unique violation, lock, missing table)" \
  --ac "Every exported error class is either thrown by a tested code path or marked @deprecated" \
  --ac "Wrapped lock errors are still retried (retry integration test passes)" \
  --ac "src/errors.ts line coverage >= 90%" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- api: compound indexes ------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
`compoundIndex()` is stored on the schema but never created in SQLite (sqlite-collection.ts never reads `compoundIndexes`). Repro: no index exists, and a unique compound index accepts duplicates. agentx declares 5 compound indexes. Audit ref: A8.

## Implementation
1. In createIndexes, create `CREATE [UNIQUE] INDEX IF NOT EXISTS "<idx>" ON "<table>"(<cols>)` for each compound index. Each column is the generated column for indexed fields, otherwise the `jsonb_extract(body, '$.path')` expression. Use the FieldResolver; JSON paths in index expressions must be literals, so build them from validated segments only.
2. Use deterministic, collision-safe index names (e.g. `idx_<table>_<name>`).
3. Flip regression case A8. Add tests that inspect `PRAGMA index_list`/`index_xinfo` and use `EXPLAIN QUERY PLAN` to show the index is used.
EOF
mk T_COMPOUND "Feature fix: actually create compound indexes (unique and non-unique)" \
  -d "$D" -l api -m "$M2" --priority High --type bug --doc "$AUDIT_DOC" --dep "$T_FIELDRES" \
  --ac "Regression case A8 passes: PRAGMA index_list shows the compound index, and a unique compound index rejects duplicates with UniqueConstraintError" \
  --ac "Compound indexes over dotted (nested) fields are created and used (EXPLAIN QUERY PLAN test)" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- api: timestamps(false) ------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
`timestamps(false)` is ignored: documents still get createdAt/updatedAt. agentx relies on it in two schemas. Audit ref: A9.

## Implementation
1. Honor `schema.timestamps === false`: returned documents omit createdAt/updatedAt. The table columns may remain (they are NOT NULL), so fill them internally.
2. Cover insert, update, replace, find, projection and events.
3. Flip regression case A9.
EOF
mk T_TIMESTAMPS "Feature fix: honor timestamps(false) in all returned documents" \
  -d "$D" -l api -m "$M2" --priority Medium --type bug --doc "$AUDIT_DOC" --dep "$T_ATOMIC" \
  --ac "Regression case A9 passes" \
  --ac "Documents from a timestamps(false) schema have no createdAt/updatedAt keys across insert, update, replace, find, findOne and event payloads (tests)" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- api: null / $ne semantics ---------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
`{ field: null }` emits `field = NULL`, which never matches. `$ne: null` never matches. `$ne: v` excludes documents where the field is null or missing (SQL three-valued logic). Audit ref: A11.

## Implementation
1. `null` equality → `IS NULL`; decide and document whether it matches missing fields (MongoDB: yes; recommended: yes, `jsonb_type(...) IS NULL`).
2. `$ne: null` → `IS NOT NULL`.
3. `$ne: v` → `(field IS NULL OR field <> ?)`; `$nin` gets the same treatment.
4. Add a "Semantics vs MongoDB" section to docs/guide covering these rules.
5. Flip regression case A11. Enable the skipped test at test/integration/complex-queries.test.ts:793.
EOF
mk T_NULLSEM "Semantics: correct null equality, \$ne and \$nin handling" \
  -d "$D" -l api -m "$M2" --priority High --type bug --doc "$AUDIT_DOC" --dep "$T_STRICTOPS" \
  --ac "Regression case A11 passes and the previously skipped null/undefined integration test is enabled and passes" \
  --ac "Documented semantics for null, missing fields, \$ne and \$nin exist in docs/guide and match tests" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG (Breaking changes section)"

# --- api: LIKE family ---------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
SQLite LIKE is ASCII case-insensitive, so `$like` equals `$ilike`. `search({ caseSensitive: true })` is ignored. `$contains`/`$startsWith`/`$endsWith`/search do not escape `%` and `_` (repro: `$startsWith: "_"` matched every row). Audit ref: A13.

## Implementation
1. Escape user text with `replace(/[\\%_]/g, "\\$&")` and add `ESCAPE '\'`.
2. Case-sensitive variants (`$like`, `$contains`, `$startsWith`, `$endsWith`, search with caseSensitive) use exact comparisons:
   - `$startsWith`: `substr(field, 1, length(?)) = ?`;
   - `$endsWith`: `substr(field, -length(?)) = ?`;
   - `$contains`: `instr(field, ?) > 0`;
   - `$like`: `GLOB` with an escaped translation.
3. Case-insensitive variants keep LIKE. Document the ASCII-only folding.
4. Flip regression case A13.
EOF
mk T_LIKE "Semantics: LIKE-family escaping and real case sensitivity" \
  -d "$D" -l api -m "$M2" --priority Medium --type bug --doc "$AUDIT_DOC" --dep "$T_FIELDRES" \
  --ac "Regression case A13 passes: \$like is case-sensitive, \$ilike is not, search caseSensitive:true is honored" \
  --ac "Literal % _ and backslash in \$contains/\$startsWith/\$endsWith/search are matched literally (tests)" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG (Breaking changes section)"

# --- api: skip without limit -------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
`find({}, { skip: 1 })` throws `near "OFFSET": syntax error`, because SQLite requires LIMIT before OFFSET. Audit ref: A14.

## Implementation
Emit `LIMIT -1 OFFSET ?` when only skip is given (through the FieldResolver's bound-parameter path). Flip regression case A14.
EOF
mk T_SKIP "Fix: skip without limit generates invalid SQL" \
  -d "$D" -l api -m "$M2" --priority Medium --type bug --doc "$AUDIT_DOC" --dep "$T_FIELDRES" \
  --ac "Regression case A14 passes: find({}, { skip: 1 }) returns n-1 documents" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- build-release: Bun floor ----------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
Decision baked in from audit 1B-B4: StrataDB 0.6.0 requires Bun >= 1.4.4. That release has update hooks and UDFs, the ALTER TABLE stale-statement fix needed for schema evolution, correct `changes` counts, SQLITE_ERROR codes and the rejected-promise transaction fix. agentx upgrades Bun 1.3.14 → 1.4.4 in the same window. If the maintainer prefers >=1.3.14, change this task before starting it.

## Implementation
1. `engines.bun` ">=1.4.4".
2. CI Bun matrix: floor 1.4.4 + latest.
3. Remove compatibility fallbacks that only exist for Bun < 1.4.4 (none expected; check).
4. README Installation section: state the requirement.
EOF
mk T_BUNFLOOR "Build: raise Bun floor to >=1.4.4 (engines + CI matrix)" \
  -d "$D" -l build-release -m "$M2" --priority Medium --type chore --doc "$AUDIT_DOC" --dep "$T_REGR" \
  --ac "package.json engines.bun is >=1.4.4 and README states the requirement" \
  --ac "CI tests on Bun 1.4.4 and the latest Bun" \
  --ac "$AC_CHANGELOG (Breaking changes section)"

# --- build-release: docs for 0.6.0 ----------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
README and docs claim behavior that is fixed or changed in 0.6.0 (retries, compound indexes, timestamps, $like/$ilike, caseSensitive, transactions). Consumers need a migration guide for the breaking changes. Audit refs: C7, SDB-22.

## Implementation
1. Update the README sections: Automatic Retries, Collection Events (delivery guarantees), Type Safety, operators.
2. Add docs/guide pages: "Semantics vs MongoDB" (if not already added) and "Migrating to 0.6".
3. CHANGELOG `[Unreleased]`: consolidate a "Breaking changes" section covering strict operators, null/$ne semantics, LIKE case, async-only errors, transaction serialization, event timing and the Bun floor.
EOF
mk T_DOCS060 "Docs: README corrections, semantics page and 0.6 migration guide" \
  -d "$D" -l build-release -m "$M2" --priority Medium --type docs --doc "$AUDIT_DOC" \
  --dep "$T_FIELDRES" --dep "$T_STRICTOPS" --dep "$T_PROMISE" --dep "$T_ATOMIC" --dep "$T_TX" --dep "$T_LISTENERS" \
  --dep "$T_ERRMAP" --dep "$T_COMPOUND" --dep "$T_TIMESTAMPS" --dep "$T_NULLSEM" --dep "$T_LIKE" --dep "$T_SKIP" --dep "$T_BUNFLOOR" \
  --ac "README no longer describes any behavior contradicted by tests (retries, compound indexes, timestamps, LIKE, events)" \
  --ac "docs/guide contains a Migrating to 0.6 page listing every breaking change with before/after code" \
  --ac "bun run docs:build succeeds"

# --- build-release: v0.6.0 prep ------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
Package the safety/correctness release. Publishing is done by the maintainer.

## Implementation
1. Confirm every regression case for A1-A6, A8, A9, A11, A13, A14 and A16 is a normal `test`; the remaining `test.failing` cases (A10, A12, A15, A17) belong to milestone 3.
2. CHANGELOG: `## [0.6.0] - <date>` with the Breaking changes section first.
3. Bump the version to 0.6.0. Run the full verification (TS matrix, lint, test, build, type tests, consumer smoke, pack dry-run).
4. Create local tag `v0.6.0` (do not push). Leave the task In Progress with notes containing the publish commands.

## Not allowed
`npm publish`, `git push --tags`.
EOF
mk T_REL060 "Release prep: v0.6.0 (verify, changelog, local tag; do not publish)" \
  -d "$D" -l build-release -m "$M2" --priority Medium --type chore --doc "$AUDIT_DOC" --dep "$T_DOCS060" \
  --ac "All regression cases scheduled for 0.6.0 run as normal tests and pass" \
  --ac "CHANGELOG has a [0.6.0] section with a Breaking changes subsection; package.json version is 0.6.0" \
  --ac "Local tag v0.6.0 exists; nothing pushed or published; publish commands are in task notes"

# =============================================================================
# MILESTONE 3: v0.7.0 DX and Performance
# =============================================================================
echo "== $M3"

# --- api: schema evolution ----------------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
`CREATE TABLE IF NOT EXISTS` never adds generated columns, so adding an indexed field to an existing collection breaks queries with "no such column". Bun 1.4.4 fixed stale statements after ALTER TABLE; still flush StrataDB's own statement cache. Audit refs: A10, 1B-B1.

## Implementation
1. On collection open, read `PRAGMA table_xinfo("<table>")`. For each schema-indexed field missing a column, run `ALTER TABLE ... ADD COLUMN "_x" <type> GENERATED ALWAYS AS (jsonb_extract(body, '$.x')) VIRTUAL` (SQLite allows this for VIRTUAL), then create its index.
2. Removed or type-changed fields: emit a warning via an `onSchemaDrift` option; an option to fail instead.
3. After DDL, clear the statement cache (and call `db.clearQueryCache()` if `db.query` is used anywhere).
4. Flip regression case A10.
EOF
mk T_SCHEMAEVO "Feature: additive schema evolution (new indexed fields on existing tables)" \
  -d "$D" -l api -m "$M3" --priority High --type feature --doc "$AUDIT_DOC" --dep "$T_REL060" \
  --ac "Regression case A10 passes: reopening a collection with a new indexed field adds the column and index and queries on it work" \
  --ac "Removed or changed fields trigger onSchemaDrift (or a configurable error) instead of silent misbehavior (tests)" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- api: event payloads ----------------------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
DeleteEvent has only `{ filter, deleted }`, with no `_id`. deleteMany/updateMany emit no per-document ids. UpdateEvent.document is `T | null` even after success. agentx's SSE route works around this and loses ids. Audit ref: A17.

## Implementation
1. Use `RETURNING _id` (optionally `json(body)`) on delete and update statements.
2. DeleteEvent: add `_id` (and optional `document` via an option); deleteMany/updateMany events: add `ids: string[]`.
3. Narrow `UpdateEvent.document` to `T` for successful non-upsert updates (discriminated union).
4. Update the type tests. Flip regression case A17.
EOF
mk T_EVENTS "Feature: rich event payloads (ids on delete/many events, narrowed types)" \
  -d "$D" -l api -m "$M3" --priority Medium --type feature --doc "$AUDIT_DOC" --dep "$T_REL060" \
  --ac "Regression case A17 passes: DeleteEvent includes _id; deleteMany and updateMany events include ids" \
  --ac "Type tests prove UpdateEvent.document is non-null for successful non-upsert updates" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- api: $elemMatch ---------------------------------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
`$elemMatch` with field keys (arrays of objects) produces `WHERE ` with an empty condition, a SQL syntax error. Audit ref: A12.

## Implementation
Non-`$` keys inside `$elemMatch` become sub-paths `json_extract(json_each.value, ?)`, recursing through the normal field-condition translator; `$` operators apply to `json_each.value` as today. Flip regression case A12 and enable the skipped test at test/integration/complex-queries.test.ts:358.
EOF
mk T_ELEMMATCH "Feature fix: \$elemMatch on arrays of objects" \
  -d "$D" -l api -m "$M3" --priority Medium --type bug --doc "$AUDIT_DOC" --dep "$T_REL060" \
  --ac "Regression case A12 passes and the previously skipped \$elemMatch integration test is enabled and passes" \
  --ac "Nested operators inside \$elemMatch (e.g. { qty: { \$gte: 2 } }) work (tests)" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- api: cursor pagination ----------------------------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
An unknown cursor id silently returns the first page. Only the first sort key is used. NULL sort values are skipped. There is no `_id` tie-breaker in ORDER BY. Audit ref: A15.

## Implementation
1. Unknown cursor → QueryError (or an explicit `invalidCursor` result; decide and document).
2. Build a lexicographic tuple comparison across all sort keys plus `_id`; always append `_id` to ORDER BY when a cursor is used.
3. Define NULL ordering (NULLS FIRST for asc, or configurable) and include it in the comparison.
4. Property test: random data with duplicates and NULLs, random multi-key sorts; walking pages yields every row exactly once.
5. Flip regression case A15.
EOF
mk T_CURSOR "Correctness: cursor pagination across all sort keys, NULLs and unknown cursors" \
  -d "$D" -l api -m "$M3" --priority Medium --type bug --doc "$AUDIT_DOC" --dep "$T_REL060" \
  --ac "Regression case A15 passes (unknown cursor is an error)" \
  --ac "A property test over random datasets and multi-key sorts proves pagination returns every row exactly once" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- api: typed field names --------------------------------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
`field<K extends keyof T | string>()` accepts any string, so typos compile. The same applies to compoundIndex fields. Audit ref: A20.

## Implementation
Constrain names to `keyof T | DocumentPath<T>` (the Paths helper already exists), keep an explicit escape hatch (e.g. `fieldUnchecked()`), and add type tests for valid paths, invalid names and nested paths.
EOF
mk T_TYPEDFIELDS "DX: type-check schema field names and compound index fields" \
  -d "$D" -l api -m "$M3" --priority Low --type enhancement --doc "$AUDIT_DOC" --dep "$T_REL060" \
  --ac "createSchema<T>().field(\"typo\") fails to compile while valid top-level and dotted paths compile (type tests)" \
  --ac "An escape hatch for untyped fields exists and is documented" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- api: collection registry -------------------------------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
`db.collection(name, schema)` returns the cached instance even when a different schema is passed. The builder and createSchema paths plumb options differently (the builder skips retry defaults). Audit ref: A21.

## Implementation
1. Compare the schema (structural hash) on cached lookups and throw SchemaValidationError on mismatch.
2. Route both creation paths through one factory so enableCache and retry defaults apply identically. Add tests.
EOF
mk T_REGISTRY "DX: detect schema mismatch on cached collections; unify creation paths" \
  -d "$D" -l api -m "$M3" --priority Low --type enhancement --doc "$AUDIT_DOC" --dep "$T_REL060" \
  --ac "Calling db.collection(name, otherSchema) after db.collection(name, schema) throws SchemaValidationError (test)" \
  --ac "Builder-created and schema-created collections receive identical cache and retry defaults (test)" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- api: update operators -----------------------------------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
updateOne only merges, so atomic counters and array appends need read-modify-write. Audit ref: A22.

## Implementation
1. Support `$set`, `$unset`, `$inc`, `$push`, `$pull` in update documents (mutually exclusive with plain merge objects), translated to `jsonb_set`/`jsonb_remove`/`jsonb_insert` expressions in a single UPDATE statement.
2. Validate paths through the FieldResolver.
3. Concurrency test: 100 concurrent `$inc: { n: 1 }` → n === 100.
EOF
mk T_UPDATEOPS "Feature: atomic update operators (\$set, \$unset, \$inc, \$push, \$pull)" \
  -d "$D" -l api -m "$M3" --priority Medium --type feature --doc "$AUDIT_DOC" --dep "$T_REL060" \
  --ac "Each operator is translated to a single UPDATE statement (test asserts SQL shape or statement count)" \
  --ac "100 concurrent \$inc updates produce exactly +100" \
  --ac "Mixing operators with plain fields in one update rejects with QueryError" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- api: read-only mode -------------------------------------------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
agentx's reference DB relies on DDL being a no-op against a read-only file. Bun 1.4.4 rejects `{ readonly: true, create: true }`. Audit refs: A22, 1B-B1.

## Implementation
1. `new Strata({ database: path, readonly: true })` opens with `{ readonly: true }` only.
2. In read-only mode, skip all DDL and reject every write method with a typed error (e.g. ConnectionError "database is read-only").
3. Tests with a temp file DB.
EOF
mk T_READONLY "Feature: read-only database mode" \
  -d "$D" -l api -m "$M3" --priority Low --type feature --doc "$AUDIT_DOC" --dep "$T_REL060" \
  --ac "readonly: true opens an existing file without running DDL and all reads work (test)" \
  --ac "Every write method rejects with a typed read-only error (test)" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- testing: property/differential ---------------------------------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
The translator is ideal for differential testing against a naive in-memory evaluator; it would catch A2/A11/A13-class bugs automatically. Audit ref: Q4.

## Implementation
1. Add fast-check.
2. Generate random documents and random filters (all supported operators, logical combinations, nested paths) over a small schema.
3. Compare StrataDB results with an in-memory reference implementation of the documented semantics (null, $ne, LIKE escaping, case rules).
4. Use a fixed seed in CI and a random seed in a nightly workflow.
EOF
mk T_PROPTEST "Testing: property-based differential tests for the query translator" \
  -d "$D" -l testing -m "$M3" --priority Medium --type chore --doc "$AUDIT_DOC" --dep "$T_REL060" --dep "$T_ELEMMATCH" \
  --ac "A fast-check suite compares StrataDB find() against an in-memory evaluator for >= 500 generated cases per CI run (fixed seed)" \
  --ac "A nightly workflow runs the suite with a random seed and reports the seed on failure" \
  --ac "$AC_GREEN"

# --- performance: statement cache ---------------------------------------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
Every operation calls `db.prepare()` (13 sites, 0 cached). Measured on findOne by indexed field: StrataDB 3.4 µs/op vs cached `db.query` 0.6 µs/op; about 60% of per-call cost is re-preparing. Bun's `db.query()` cache is only 20 entries per connection, and `Database.MAX_QUERY_CACHE_SIZE` is a process-wide static, so do not rely on or mutate it. Audit refs: P1, P2, 1B-B2.

## Implementation
1. Add a per-collection LRU of prepared statements keyed by SQL text (configurable size, default ~64).
2. Finalize statements on close(), drop() and after DDL (schema evolution).
3. Benchmark: findOne by indexed field, x50k (bench/crud-operations.bench.ts).
4. Re-evaluate the translator's SQL-string cache (P2); remove it if the statement cache makes it redundant (benchmark both).
EOF
mk T_STMTCACHE "Performance: per-collection prepared-statement LRU" \
  -d "$D" -l performance -m "$M3" --priority High --type enhancement --doc "$AUDIT_DOC" --dep "$T_SCHEMAEVO" \
  --ac "findOne-by-indexed-field benchmark is >= 3x faster than v0.6.0 on the same machine (record both numbers in the PR/notes)" \
  --ac "Statements are finalized on close(), drop() and DDL; using a collection after close() still yields the closed-database error" \
  --ac "The translator SQL cache is removed or kept with benchmark justification in notes" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- performance: projection pushdown ---------------------------------------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
find() selects and parses whole documents, then drops fields in JS. Audit ref: P3.

## Implementation
For inclusion projections, build `json_object('a', jsonb_extract(body, ?), ...)` (paths via the FieldResolver) and parse only that; keep the JS path for exclusion projections. Benchmark wide documents (50 fields) projecting 2 fields.
EOF
mk T_PROJECTION "Performance: push inclusion projections into SQL" \
  -d "$D" -l performance -m "$M3" --priority Low --type enhancement --doc "$AUDIT_DOC" --dep "$T_STMTCACHE" \
  --ac "Inclusion projections are computed in SQL (test inspects generated SQL)" \
  --ac "A wide-document benchmark shows a measurable improvement (numbers recorded in notes)" \
  --ac "Projection behavior is unchanged (existing projection tests pass)" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- deps: runtime deps ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
Runtime deps are behind: deepmerge-ts 7 → 8 (agentx already forces ^8 via overrides, an untested combination), p-retry 7 → 9, @standard-schema/spec 1.0 → 1.1. fast-safe-stringify is unnecessary for JSON documents. Audit ref: D3.

## Implementation
1. Upgrade deepmerge-ts to 8, or remove it if the atomic-writes task made it unused.
2. Upgrade p-retry to 9 (read its changelog; adapt `RetryContext` types) and @standard-schema/spec to 1.1.
3. Replace fast-safe-stringify with JSON.stringify, throwing ValidationError on circular input; add a test.
4. Run the consumer smoke test.
EOF
mk T_RUNTIMEDEPS "Dependencies: upgrade deepmerge-ts 8, p-retry 9, standard-schema 1.1; drop fast-safe-stringify" \
  -d "$D" -l deps -m "$M3" --priority Medium --type chore --doc "$AUDIT_DOC" --dep "$T_REL060" \
  --ac "bun outdated shows no outdated runtime dependency" \
  --ac "fast-safe-stringify is removed; circular documents reject with ValidationError (test)" \
  --ac "Consumer smoke test passes" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- deps: dev toolchain ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
Biome 2.3.6 → 2.6.x, ultracite 6.3.4 → 8.x (two majors), commitlint 20 → 21, plus typedoc-plugin-markdown, vitepress-carbon, arktype/zod/valibot (Standard Schema tests). Audit ref: D4.

## Implementation
Upgrade them one tool at a time, run `ultracite fix`, review the rule changes, and keep the lint output at zero. Move to TypeScript 7.1 when GA if available (re-evaluate the TypeDoc workspace and the tsgo d.ts generator then).
EOF
mk T_DEVDEPS "Dependencies: upgrade Biome/ultracite, commitlint and remaining dev tooling" \
  -d "$D" -l deps -m "$M3" --priority Low --type chore --doc "$AUDIT_DOC" --dep "$T_REL060" \
  --ac "bun outdated shows no outdated devDependency except ones documented as intentionally pinned (with reason in notes)" \
  --ac "bun run lint passes with zero warnings after the ultracite major upgrade" \
  --ac "$AC_GREEN"

# --- performance: optional bun features -------------------------------------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
Bun 1.4.4 adds `db.function()`/`db.aggregate()` (UDFs) and row-level update hooks. UDFs enable a `$regex` operator and Unicode-aware case folding. Hooks enable optional change capture, with caveats: not commit-aware, skipped for unfiltered DELETE and INSERT OR REPLACE, one hook per Database, throws become uncaught exceptions. Audit ref: 1B-B2.

## Implementation
1. Add a `$regex` operator via `db.function("strata_regexp", { deterministic: true }, ...)`, registered once per Database, validating the pattern, and documented as non-indexable.
2. Optional: a Unicode-aware `$ilike` mode using a UDF.
3. Optional (behind an option, off by default): a change-capture mode via `onInsert`/`onUpdate`/`onDelete` that emits events for writes made outside StrataDB, documented with all caveats.
EOF
mk T_UDF "Feature: \$regex via SQLite UDF and optional update-hook change capture (Bun 1.4.4)" \
  -d "$D" -l api,performance -m "$M3" --priority Low --type feature --doc "$AUDIT_DOC" --dep "$T_REL060" \
  --ac "\$regex filters work and invalid patterns reject with QueryError (tests)" \
  --ac "Change-capture mode is opt-in, documented with its caveats, and tested for insert/update/delete via raw SQL" \
  --ac "$AC_GREEN" --ac "$AC_CHANGELOG"

# --- performance: bench tracking -----------------------------------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
The mitata benchmarks exist but are not tracked over time, so regressions are invisible. Audit ref: Q7.

## Implementation
Add a workflow (workflow_dispatch + weekly schedule) that runs `bun run bench:all` and uploads results as an artifact. Optionally compare with the previous artifact and comment on large regressions.
EOF
mk T_BENCH "Performance: benchmark tracking workflow" \
  -d "$D" -l performance,build-release -m "$M3" --priority Low --type chore --doc "$AUDIT_DOC" --dep "$T_STMTCACHE" \
  --ac "A workflow runs bench:all on demand and weekly and uploads results as an artifact" \
  --ac "README or CONTRIBUTING explains how to read the benchmark artifact"

# --- api: split sqlite-collection ---------------------------------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
src/sqlite-collection.ts is 2,204 lines with ts-expect-error and biome-ignore suppressions. Do this after the behavior work to avoid merge conflicts. Audit refs: C3, C4, D7.

## Implementation
1. Split into ddl.ts, read-ops.ts, write-ops.ts, events.ts and sql-builders.ts.
2. Replace the 5 `@ts-expect-error` around EventEmitter typing with a typed facade.
3. Refactor insertMany to remove the cognitive-complexity suppression.
4. Make no behavior change: test suite and benchmarks are identical before and after.
EOF
mk T_SPLIT "Refactor: split sqlite-collection.ts and remove type/lint suppressions" \
  -d "$D" -l api -m "$M3" --priority Low --type chore --doc "$AUDIT_DOC" \
  --dep "$T_SCHEMAEVO" --dep "$T_EVENTS" --dep "$T_ELEMMATCH" --dep "$T_CURSOR" --dep "$T_UPDATEOPS" --dep "$T_READONLY" --dep "$T_STMTCACHE" --dep "$T_PROJECTION" \
  --ac "No source file in src/ exceeds ~600 lines" \
  --ac "No @ts-expect-error remains for EventEmitter typing and no biome-ignore complexity suppression remains in collection code" \
  --ac "Test results and benchmark numbers are unchanged within noise (recorded in notes)" \
  --ac "$AC_GREEN"

# --- build-release: docs & repo cleanup ---------------------------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
DESIGN.md is duplicated (root 4,039 lines vs docs/DESIGN.md 4,047 lines, diverged). COLLECTION_EVENTS_DESIGN.md and a 658-line .github/copilot-instructions.md sit at the root. Agent instructions must match post-0.6 behavior. Audit refs: C5, C6, C7.

## Implementation
1. Keep docs/DESIGN.md; delete the root copy or replace it with a link.
2. Move COLLECTION_EVENTS_DESIGN.md into docs/design/.
3. Update .github/copilot-instructions.md, CLAUDE.md and AGENTS.md to the current APIs and behaviors (operators, transactions, events, errors).
4. Make sure docs:build still works.
EOF
mk T_DOCSCLEAN "Docs: deduplicate design docs and update agent instructions" \
  -d "$D" -l build-release -m "$M3" --priority Low --type docs --doc "$AUDIT_DOC" --dep "$T_SPLIT" \
  --ac "Only one DESIGN.md exists (docs/) and design leftovers live under docs/design/" \
  --ac "Agent instruction files describe the current API (no references to removed or changed behavior)" \
  --ac "bun run docs:build succeeds"

# --- build-release: v0.7.0 prep ---------------------------------------------------------------------------------------------------------------------------------------------------------
read -r -d '' D <<'EOF' || true
## Why
Package the DX and performance release. Publishing is done by the maintainer.

## Implementation
1. Confirm no `test.failing` cases remain in test/regression.
2. CHANGELOG `## [0.7.0] - <date>`; bump version to 0.7.0.
3. Run the full verification (TS matrix, lint, test, build, type tests, consumer smoke, pack dry-run, benchmarks recorded).
4. Create local tag v0.7.0 (do not push). Leave the task In Progress with notes containing the publish commands.

## Not allowed
`npm publish`, `git push --tags`.
EOF
mk T_REL070 "Release prep: v0.7.0 (verify, changelog, local tag; do not publish)" \
  -d "$D" -l build-release -m "$M3" --priority Medium --type chore --doc "$AUDIT_DOC" \
  --dep "$T_SCHEMAEVO" --dep "$T_EVENTS" --dep "$T_ELEMMATCH" --dep "$T_CURSOR" --dep "$T_TYPEDFIELDS" --dep "$T_REGISTRY" \
  --dep "$T_UPDATEOPS" --dep "$T_READONLY" --dep "$T_PROPTEST" --dep "$T_STMTCACHE" --dep "$T_PROJECTION" --dep "$T_RUNTIMEDEPS" \
  --dep "$T_DEVDEPS" --dep "$T_UDF" --dep "$T_BENCH" --dep "$T_SPLIT" --dep "$T_DOCSCLEAN" \
  --ac "No test.failing cases remain in test/regression" \
  --ac "CHANGELOG has a [0.7.0] section; package.json version is 0.7.0; all verification commands pass" \
  --ac "Local tag v0.7.0 exists; nothing pushed or published; publish commands are in task notes"

echo
echo "Done. Next: backlog task list --plain   |   backlog board"
