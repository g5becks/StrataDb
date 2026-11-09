# StrataDB Audit — v0.5.0

| | |
|---|---|
| **Repository** | `/Users/takinprofit/Dev/StrataDb` (`g5becks/StrataDb`, branch `main`, clean) |
| **Package** | `stratadb@0.5.0` (published 2026-01-09; no commits since) |
| **Audit date** | 2026-11-08 |
| **Runtime used** | Bun 1.4.4 (macOS arm64) |
| **Primary consumer** | `agentx` (`infra/`, `server/`, `.scripts/`) |

---

## 0. Executive Summary

StrataDB has a clean architecture and a well-documented surface. It also has a large test suite: 715 tests and 97% line coverage. The suite mostly checks the *happy path* of each method, though. Hostile inputs, concurrent calls, nesting and SQLite's real error shapes are not tested. Behavioral repros run during this audit confirmed **16 functional bugs**. Two of them are critical safety issues:

1. **SQL injection.** Filter keys, sort keys, search fields, `$index` indices, `limit` and `skip` are interpolated directly into SQL.
2. **Silent data loss.** An unknown or mistyped operator, such as `{ status: { $eqq: "x" } }`, is ignored. The filter then matches everything, and `deleteMany` with such a filter **deleted the whole collection** in a repro.

Several headline features **don't work as documented**:

- Automatic retries never fire on real SQLite lock errors.
- `compoundIndex()` never creates an index.
- `timestamps(false)` is ignored.
- `updateOne` is not atomic, so conditional updates used as compare-and-swap both "win".
- Batch operations can't run inside `db.execute()`.
- `removeAllListeners()` with no argument removes nothing. Two tests fail on the current Bun.

**Platform currency:** StrataDB 0.5.0 predates **Bun 1.4** and **TypeScript 7**:
- Its source typechecks on TS 7.0.2 once `"types": ["bun"]` is set, but its build and docs toolchain (`tsdown@0.16`, `typedoc`, `tsd`) doesn't work on TS 7 (§1A).
- Bun 1.4's Node-compatible `EventEmitter` is what broke the two tests.
- Bun 1.4.4 adds `bun:sqlite` capabilities worth adopting: UDFs, update hooks, a bounded query cache (§1B).
- On macOS, the SQLite engine is the OS's own, and nothing checks its version.

The fix list is substantial, but most items are local, low-risk changes. Several share one root cause (§2.1, §4.1). **Recommended next release: `0.6.0`**, a safety-and-correctness release with intentional, documented behavior changes, preceded by a small guardrails pass (CI + TS 7 toolchain). See §5.

### Baseline health (measured)

| Check | Result |
|---|---|
| `bun test` on Bun 1.4.4 (current) | **710 pass / 2 fail / 3 skip** (715 tests, 30 files, ~0.36 s) |
| `bun test` on Bun 1.3.6 (era of the 0.5.0 release) | 712 pass / **0 fail** / 3 skip. The 2 failures are caused by Bun 1.4 (A18). |
| `bun test --coverage` | 97.16% lines / 96.22% functions overall; `errors.ts` 63.6% lines |
| `tsc --noEmit` (TS 5.9.3, the repo's pinned version) | ✅ clean |
| `tsc --noEmit` (TS 6.0.3, agentx's current version) | ❌ **56 errors**; 0 with `types: ["bun"]` |
| `tsc --noEmit` (**TS 7.0.2, latest**) | ❌ **56 errors**, the same cause; **0 with `types: ["bun"]`** |
| Build / docs toolchain on TS 7.0.2 | ❌ `tsdown@0.16.6` and `typedoc@0.28` crash (no classic compiler API); ✅ `tsdown@0.23.7` builds (§1A) |
| `ultracite check` (Biome 2.3.6) | ✅ clean (76 files) |
| `tsdown` build | ✅ `index.mjs` 109.5 kB (26.5 kB gzip); `index.d.mts` 158.7 kB |
| `tsd` type tests | ✅ pass |
| CI | ❌ none for tests/lint/typecheck (only `deploy-docs.yml`) |

### Evidence legend

- **[Repro]**: confirmed by running a script against `src/` during this audit (scripts in Appendix A).
- **[Code]**: confirmed by reading the source; exact location given.
- **[Measured]**: number produced by running a command or benchmark.

### Severity legend

**Critical**: data loss or security issue reachable through normal API use. **High**: a documented feature is broken, or a correctness bug likely in production. **Medium**: incorrect edge-case behavior or a significant DX defect. **Low**: polish or hygiene.

---

## 1. Dependencies & APIs

### D1 — Published types depend on a devDependency (`type-fest`) · **High** · [Code][Measured]
`src/core-types.ts` imports `Except`, `PartialDeep`, `ReadonlyDeep`, `SetOptional` and `Simplify` from `type-fest`. The built `dist/index.d.mts` keeps `import { Except, Get, PartialDeep, Paths, ReadonlyDeep, SetOptional, Simplify } from "type-fest"` (line 5). `type-fest` is only in `devDependencies`. Consumers who don't happen to have `type-fest` installed get unresolved types. With `skipLibCheck`, these silently degrade to `any`.
**Fix:** move `type-fest` to `dependencies` (or `peerDependencies`), or have tsdown inline those types in the `.d.mts` bundle. **Verified:** upgrading to `tsdown@0.23.7` inlines them automatically. The `type-fest` import disappears from the output, and `index.d.mts` grows from 158.7 kB to 245.6 kB. The choice is now *inline* (zero type deps, larger `.d.ts`) or *dependency* (smaller `.d.ts`, one more install). Inlining is the safer default. Add a "consumer smoke" check that packs the tarball and typechecks a fixture project without dev deps (see Q8).

### D2 — Not compatible with TypeScript 6 or 7 · **High** · [Measured]
TS 6 changed the default of `compilerOptions.types` to `[]`, and TS 7 keeps it, so `bun-types` is no longer picked up automatically. `tsc` 6.0.3 and `tsc` 7.0.2 each report 56 errors, including `Cannot find module 'bun:sqlite'`, `Cannot find name 'Bun'`, `Cannot find name 'node:events'`, and missing `EventEmitter` members. Passing `--types bun` brings **both to 0 errors**. No tsconfig option StrataDB uses was removed in TS 7. The source is TS 7-ready; the **toolchain is not**. See **§1A** for the full TypeScript 7 migration, which is the target per the agentx plan.
**Fix:** add `"types": ["bun"]` to `tsconfig.json`, then follow §1A.

### D3 — Runtime dependencies behind latest · **Medium** · [Measured]

| Package | Installed | Latest | Notes |
|---|---|---|---|
| `deepmerge-ts` | 7.1.5 | **8.0.2** | agentx already forces `^8` via `overrides`, so the version StrataDB ships with in agentx has never been tested here. |
| `p-retry` | 7.1.1 | **9.0.0** | Two majors behind; used by `retry-utils.ts`. |
| `@standard-schema/spec` | 1.0.0 | 1.1.0 | Minor. |
| `fast-safe-stringify` | 2.1.1 | 2.1.1 | Last published 2022. A circular-safe stringify isn't needed for JSON documents bound for SQLite. Consider `JSON.stringify` and throwing `ValidationError` on cycles; this would remove a dependency. |

**Fix:** upgrade `deepmerge-ts` to 8 and `p-retry` to 9, and run the suite. Evaluate dropping `fast-safe-stringify`. Also evaluate whether `deepmerge-ts` is needed at all once `updateOne` moves to SQL-side `jsonb_patch` (see P4).

### D4 — Dev toolchain drift · **Medium** · [Measured]

| Tool | Installed | Latest | Impact |
|---|---|---|---|
| `tsdown` | 0.16.6 | **0.23.7** | **Required for TS 7** (0.16.6 crashes). Verified: 0.23.7 with `rolldown-plugin-dts@0.30.0` (peer `typescript ^5 \|\| ^6 \|\| ~7.0 \|\| ~7.1`) builds on TS 7.0.2 with the same runtime externals. It warns that `external` is deprecated (use `deps.neverBundle`). |
| `@biomejs/biome` | 2.3.6 | 2.6.6 | |
| `ultracite` | 6.3.4 | **8.1.1** | Two majors behind; it pins the Biome preset. |
| `typescript` | 5.9.3 | **7.0.2** (7.1.0-beta out 2026-10-20) | Target 7.0.x; see §1A. |
| `@types/bun` | `latest` (1.3.2 in the lockfile) | 1.4.4 | `latest` is unpinned, so builds aren't reproducible. Pin to 1.4.4: it adds the new `bun:sqlite` APIs (§1B), and its `typesVersions` entry selects `ts7.1/index.d.ts` on TS ≥ 7.1. |
| `@types/node` | 24.10.1 (transitive, stale) | 26.6.6 | **Verified:** `bun-types@1.4.4` on TS 7 with `skipLibCheck: false` fails on 24.10.1 (`KeyObject`, `TLSSocket`, `TextEncoderEncodeIntoResult`), and has 0 errors with 26.6.6. Pin it explicitly as a devDependency. |
| `typedoc` | 0.28.15 | 0.28.20 | **Latest still caps at TS 6.0.x** (peer `5.0.x … 6.0.x`) and crashes on TS 7. See §1A. |
| `tsd` | 0.33.0 | 0.33.0 | Bundles its own TS 5.9.3 (`@tsd/typescript`), so type tests never run on TS 6 or 7. See §1A and Q6. |
| `@commitlint/*` | 20.x | 21.x | |
| Others | — | — | `typedoc*`, `vitepress-carbon`, `arktype`, `zod` and `valibot` (dev, used by the Standard Schema tests) are behind by minor versions. |

### D5 — Build target and runtime don't match · **Medium** · [Code]
`tsdown.config.ts` uses `platform: "node", target: "node20"`. The library can only run on Bun, because it imports `bun:sqlite` and uses `Bun`-specific behavior. `package.json` has no `engines` field, so npm and Node users get a runtime crash rather than an install-time warning.
**Fix:** `platform: "neutral"` (or `"node"` with `target: "esnext"`), plus an `engines.bun` floor (see §1B for the version decision). **Verified:** `platform: "neutral"` changes the output names to `index.js`/`index.d.ts`. Either set `fixedExtension: true` to keep `.mjs`/`.d.mts`, or update `main`, `module`, `types` and `exports` in the same change, or consumers break. State "Bun-only" prominently in the README and in the package `description`.

### D6 — Package metadata gaps · **Low** · [Code]
`package.json` has no `license`, `repository`, `homepage`, `bugs`, `keywords`, `engines` or `sideEffects` fields. A `LICENSE` file exists. The `.d.mts.map` and `.mjs.map` files reference `../src/*.ts`, but `files` only ships `dist`, so "go to definition" lands nowhere. There are no git tags for any release.
**Fix:** add the metadata and `"sideEffects": false`. Either ship `src/` or drop `declarationMap`. Tag releases (`v0.5.0` retroactively) and publish with npm provenance.

### D7 — Modern-syntax and platform opportunities · **Low** · [Code]
- Cache statements instead of calling `db.prepare()` per call, in StrataDB's own LRU rather than Bun's 20-entry global `db.query()` cache. See P1 and §1B-B2.
- Adopt the Bun 1.4.4 `bun:sqlite` additions where they fit: UDFs, update hooks (opt-in only), and `stmt.isFinalized`. See §1B-B2.
- Use `bun:sqlite`'s `db.transaction()`, which nests correctly through SAVEPOINTs, instead of hand-written `BEGIN`/`COMMIT`. See A4.
- Use `Promise.try` (Bun supports it) or `async` methods to guarantee promise-only error delivery. See A5.
- Use `Database` options `{ strict: true }` and consider `safeIntegers` for INTEGER columns holding values above 2^53.
- `using`/`Symbol.dispose` are already used. `Transaction` could also implement `Symbol.asyncDispose`.
- Five `@ts-expect-error` comments around `EventEmitter` typing (`sqlite-collection.ts:166,2157,2166,2176`) can be removed by typing the emitter wrapper properly, for example with a thin typed facade instead of `extends EventEmitter<Map>`.

---

## 1A. TypeScript 7 Migration (target: `typescript@7.0.x`)

TypeScript 7.0 (GA 2026-07-08; 7.0.2 is `latest`) is the Go-native compiler. It ships in the regular `typescript` package as `tsc`. Because agentx is moving to TS 7 as well, StrataDB should **develop, test and publish against TS 7.0.x** and keep TS 5.9/6.0 consumers working. This was tested in a throwaway copy of the repo with `typescript@7.0.2` installed.

### What TS 7 changes for this repo (verified)

| Area | Result on TS 7.0.2 | Evidence |
|---|---|---|
| Source typecheck | ✅ 0 errors with `"types": ["bun"]`; ❌ 56 without it | [Measured] |
| tsconfig options | ✅ No option StrataDB uses was removed. It already uses `moduleResolution: "bundler"`, `module: "ESNext"`, `esModuleInterop: true`, and has no `baseUrl`. | [Measured] |
| Compiler API | ❌ `require("typescript")` now resolves to `lib/version.cjs`, which exports only `version`/`versionMajorMinor`. The classic `ts.createProgram` API is gone; a new API exists only under `typescript/unstable/*`. | [Code] package `exports` |
| `tsdown@0.16.6` (current) | ❌ crashes: `TypeError: Cannot read properties of undefined (reading 'useCaseSensitiveFileNames')` | [Measured] |
| `tsdown@0.23.7` (latest) | ✅ builds; d.ts generated by the **tsgo generator**, which warns: *"The `tsgo` generator on TypeScript 7.0 is deprecated and will be removed in the next minor. Upgrade to TypeScript 7.1 or later."* | [Measured] |
| `tsdown@0.23.7`, `dts: { generator: "oxc" }` | ✅ builds in ~0.2 s. Doesn't depend on the TS version: it uses isolated declarations. Output still inlines `type-fest`. | [Measured] |
| `--isolatedDeclarations` readiness | **1 error**, `src/deep-merge.ts:70` (`deepMerge` needs an explicit type annotation). That symbol is internal, not exported from `index.ts`. | [Measured] |
| `typedoc@0.28.x` (latest 0.28.20) | ❌ crashes: `Cannot read properties of undefined (reading 'PropertyDeclaration')`; peer range caps at TS 6.0.x | [Measured] |
| `tsd@0.33` | ⚠️ runs, but checks types with its bundled **TS 5.9.3**, so it says nothing about TS 6/7 | [Code] |
| `bun test` | ✅ unaffected (Bun strips types itself) | [Measured] |
| Published `.d.ts`, consumed on TS 7 | ✅ A consumer fixture typechecked with `skipLibCheck: false`, including an `@ts-expect-error` proving that wrong field types are rejected. It needs `@types/node` ≥ 26 (see D4). | [Measured] |
| Biome / ultracite | ✅ Rust tools; independent of the TS version | — |

### Recommended setup
1. **Compiler:** `typescript@~7.0.2` as the dev dependency; `"types": ["bun"]` in `tsconfig.json`. Add `"isolatedDeclarations": true` and fix `deep-merge.ts:70`, so the public API stays emit-friendly.
2. **Declarations:** `tsdown@^0.23.7` with `dts: { generator: "oxc" }`. This avoids the deprecated TS 7.0 tsgo generator, and the output doesn't depend on which TS version is installed. Re-evaluate `generator: "tsgo"` once on TS 7.1+, if oxc output ever diverges.
3. **Type tests:** replace `tsd` with `expect-type` assertions in `test/type/*.ts`, checked by the project's own `tsc --noEmit`. That runs on whatever TS is installed, including 7.x, with no build step. Alternatively `tstyche@7`, but confirm its TS 7 support first, since it relies on the compiler API.
4. **API docs:** TypeDoc has no TS 7 release yet, and it imports `typescript` by that exact name. Installing `@typescript/typescript6` (6.0.2 on npm) alongside TS 7 won't be picked up on its own. The simplest working setup is a small separate docs package (e.g. `docs/package.json` with `typescript@~6.0` + `typedoc` + plugins) that `docs:build` runs in. Track TypeDoc's TS 7 support and fold the docs package back in when it ships. (Not yet tested: the exact setup was not built during this audit.)
5. **Compatibility matrix in CI:** typecheck `src/` and the consumer fixture with TS **7.0** (blocking), **6.0** (blocking, for consumers not yet migrated) and **5.9** (blocking until a documented drop), plus **7.1-beta** (non-blocking).
6. **Watch TS 7.1** (beta 2026-10-20): it brings the stable compiler API back. Once it's GA, TypeDoc, `tsd`-style tools and the tsgo d.ts generator become viable again.

> **agentx alignment:** agentx is on `typescript ~6.0.3` (root, server, client, `.scripts`) and typechecks with a pre-GA `@typescript/native-preview@7.0.0-dev.20260707.2` (`tsgo`) pinned in `mise.toml`. Its `core`/`infra` already use `tsdown ^0.23.4`. Moving agentx to `typescript@7.0.x` (`tsc`) and dropping the native-preview pin is the matching step. Audit agentx's own compiler-API consumers in its own pass.

## 1B. Bun 1.4 Runtime and `bun:sqlite` Changes

StrataDB 0.5.0 was released when Bun 1.3.x was current, against `@types/bun` 1.3.2. Bun 1.4.0 shipped on 2026-08-19, and 1.4.4 is current. Sources: the official [Bun 1.4](https://bun.com/blog/bun-v1.4) and [Bun 1.4.4](https://bun.com/blog/bun-v1.4.4) release notes; a type diff of `bun-types` 1.3.2 → 1.4.4 (`sqlite.d.ts`); and runtime probes on Bun 1.3.6 and 1.4.4. The [1.4 breaking-changes issue](https://github.com/oven-sh/bun/issues/28792) could only be read partially. Items marked "[summary]" come from a summarized part of the 1.4.4 notes, not verbatim text.

### B1 — Changes that affect StrataDB today

| Change | Version | Impact on StrataDB | Action |
|---|---|---|---|
| `EventEmitter` follows Node semantics, so `removeAllListeners(undefined)` is treated as an event name. The 1.4 notes say `node:events` now passes 100% of Node's test suite. | 1.4.0 | **Root cause of the 2 failing tests (A18).** Verified: `collection-events.test.ts` passes 97/97 on Bun 1.3.6 and fails on 1.4.4; the full suite is 0 fail on 1.3.6. | SDB-03 |
| Generic SQLite errors (syntax, unknown table/column) now set `error.code = "SQLITE_ERROR"`. Previously `undefined`; `errno: 1` either way. | 1.4.x | Measured: `code` is `undefined` on 1.3.6 and `"SQLITE_ERROR"` on 1.4.4. Error mapping (A19) can rely on `code` only from 1.4.x, so map by **`errno`** to cover both. | SDB-16 |
| `SQLiteError` has `code?: string` and `errno: number` (extended code). | Unchanged since v1.0.21 | The A7 retry bug **is not a Bun regression**; the numeric-`code` check was always wrong. | SDB-06 |
| Binding a `Date`, `Map` or `Promise` as a parameter now throws `TypeError` instead of silently binding `NULL`. | 1.4.4 [summary]; verified: 1.3.6 bound NULL, 1.4.4 throws | `toBindValue()` already rejects these with `QueryError`. But **`$index` pushes `condition` without `toBindValue`** (`sqlite-query-translator.ts:~935`), so a `Date` there silently became NULL on 1.3.x and throws a raw `TypeError` on 1.4.4. | SDB-10 |
| `changes` now counts only the statement's own rows, not trigger/FK-cascade/FTS5 shadow rows. | 1.4.4 [summary] | `deleteOne`/`deleteMany` use `result.changes`. Counts were inflated on older Bun only with triggers or cascades, which StrataDB doesn't create. User-added triggers were affected. | Note in docs |
| `db.close()` finalizes **every** `db.query()` statement; a finalized statement throws when used. `db.close(true)` also finalizes `prepare()`d statements. | 1.4.0 | Relevant to the statement cache in P1: cached statements must be dropped with the database, and using a collection after `close()` must fail with a clear StrataDB error, not "Statement has finalized". | SDB-40 |
| An existing `Statement` returned **old column names** after `ALTER TABLE`. | Fixed 1.4.4 [summary] | Directly relevant to schema evolution (SDB-30), which runs `ALTER TABLE … ADD COLUMN` while statements may be cached. On < 1.4.4, call `db.clearQueryCache()` and drop StrataDB's own cache after DDL. | SDB-30 |
| `db.transaction(fn)` committed when `fn` returned an already-rejected promise; now rolls back. | Fixed 1.4.4 [summary] | `db.transaction()` is still **synchronous-only**. Async callbacks must not be used with it. Relevant to the SDB-14 design. | SDB-14 |
| `{ readonly: true, create: true }` now throws `TypeError`; `create: false` on an existing file no longer fails with `SQLITE_MISUSE`. | 1.4.4 [summary] | Constrains the planned read-only mode (SDB-37): open with `{ readonly: true }` only. | SDB-37 |
| `db.run("a; b")` and `db.exec()` used to swallow errors in non-final statements; now they throw at the failing statement. | 1.4.4 [summary] | StrataDB only `exec`s single statements (`BEGIN`/`COMMIT`/`ROLLBACK`/`DROP`). Not affected. | — |
| `Statement` reuse with a live `iterate()` cursor; lost writes on early `break` | 1.4.x | StrataDB never uses `iterate()`. Not affected. Relevant if streaming cursors are added later. | — |

### B2 — New `bun:sqlite` capabilities to use (types added in `bun-types` 1.4.4)

| API | What it enables | Caveats (from the 1.4.4 type docs) | Where |
|---|---|---|---|
| `Database.MAX_QUERY_CACHE_SIZE` (default **20**, measured) and `db.clearQueryCache()` | Bounded LRU behind `db.query()` | **20 distinct SQL strings per connection** is small: StrataDB builds roughly a dozen or more distinct SQL strings per collection (an estimate: one per operation, more per filter shape), so a 9-collection app like agentx would evict constantly. It's a **`static`** property, so raising it changes the host app's other `Database` instances too. → StrataDB should keep **its own per-collection statement LRU** (using `prepare()`, finalized on `close()`/`drop()`) rather than rely on or mutate the global. | P1 / SDB-40 |
| `db.function(name, opts, fn)` / `db.aggregate()` (better-sqlite3-compatible; options `deterministic`, `varargs`, `directOnly`, `safeIntegers`) | `$regex` operator; true case-sensitive `$like`/`search` and Unicode-aware `$ilike` (A13) without LIKE's ASCII-only folding | A JS function in `WHERE` can't use an index and runs per row. Use it only where no index applies. While `fn` runs, other uses of the connection throw "busy". Register once per `Database`. | A13, new `$regex` |
| `db.onInsert` / `db.onUpdate` / `db.onDelete` (row-level update hooks: table, rowid, schema) | Could detect writes made outside StrataDB's API, and give `_id`s for `deleteMany` events (A17) via a rowid lookup | Fires **per statement, not on commit**, so transaction buffering (SDB-14) is still needed. **Not fired** for unfiltered `DELETE` (truncate optimization), rows removed by `INSERT OR REPLACE`, or other connections. The DB can't be queried inside the hook. A throwing hook becomes an *uncaught exception*. One hook per `Database`, so it would conflict with a host app's own hook. → Use only as an optional, documented change-capture mode, not as the core of the events system. | A17, optional |
| `stmt.reader`, `stmt.readonly`, `stmt.isFinalized`, `stmt.safeIntegers()`, `stmt.toJSON()` | Statement-cache hygiene (`isFinalized`), debug output, and enforcing read-only statements in read-only mode | — | SDB-37, SDB-40 |
| `db[Symbol.for("sqlite-type")] === "bun:sqlite"` | Reliable check that the `database` option passed in is a Bun `Database` | — | Constructor validation |
| Type changes: `values()` return no longer includes `boolean` (adds `null`); bind params accept `ArrayBufferLike`; option fields typed `boolean \| undefined`; `export var native` removed | Type-level only | StrataDB uses none of `values()` or `native`. `exactOptionalPropertyTypes` is satisfied by the new `\| undefined` option types. | — |

### B3 — SQLite engine version is platform-dependent and unchecked · **High** · [Measured]
StrataDB requires SQLite **≥ 3.45.0** for `jsonb()`/`jsonb_extract()`, but never checks it.
- **Linux/Windows:** Bun bundles SQLite (3.53.0 since Bun 1.3.14, per the 1.4 notes).
- **macOS:** Bun loads the **system** `libsqlite3.dylib`. The Bun binary references `libsqlite3.dylib`, and both Bun 1.3.6 and 1.4.4 report `sqlite_version()` = 3.54.0 here, which equals `/usr/bin/sqlite3 --version` on macOS 27.2.

The SQLite version on macOS is therefore whatever the OS ships. Older macOS releases can ship a pre-3.45 SQLite, where every StrataDB table creation fails with an obscure "no such function: jsonb_extract". The compile options also differ by platform; this build has FTS5, MATH_FUNCTIONS, PREUPDATE_HOOK and UPDATE_DELETE_LIMIT.
**Fix:** in the `Strata` constructor, check `select sqlite_version()` against 3.45.0 and throw a `ConnectionError` that names `Database.setCustomSQLite()` as the macOS remedy. Document the requirement in the README. Add a CI job on `macos-latest` and `ubuntu-latest`.

### B4 — Bun version floor (decision needed)
agentx currently pins **Bun 1.3.14** (`agentx/mise.toml`). Options for StrataDB 0.6.0:

| Floor | Pros | Cons |
|---|---|---|
| **`>=1.4.4` (recommended)** | Native update hooks and UDFs available unconditionally; the ALTER TABLE stale-statement fix that SDB-30 relies on; correct `changes`; `SQLITE_ERROR` codes; rejected-promise transaction fix; one runtime to test. | agentx must bump Bun 1.3.14 → 1.4.4 together with its TS 7 move. 1.4.0 also has other breaking changes to review on the agentx side. |
| `>=1.3.14` | No forced agentx runtime bump | Feature-detect hooks and UDFs (`typeof db.function === "function"`); work around stale statements after DDL; test-matrix both lines |

Either way, CI runs the floor version plus `latest`, and `engines.bun` states the floor. Because agentx is being upgraded anyway, the recommendation is a **coordinated bump: StrataDB 0.6.0 requires Bun ≥ 1.4.4 and TS 7.0 tooling, and agentx moves to Bun 1.4.4 and TS 7.0 in the same window.**

---

## 2. API & DX Design

### 2.1 Safety

#### A1 — SQL injection via identifiers and numeric options · **Critical** · [Repro][Code]
Field names are interpolated into SQL text in **five separate places**:

- `sqlite-query-translator.ts:766` `resolveFieldName`, which returns `` `jsonb_extract(body, '$.${fieldStr}')` ``.
- `sqlite-collection.ts:441` `buildSearchClause`.
- `sqlite-collection.ts:483` `buildSortClause`.
- `sqlite-collection.ts:513` `buildCursorClause`.
- `sqlite-collection.ts:256` `createTable` and `createIndexes`, for the DDL.

In addition:

- `$index` interpolates `index` into `'$[${index}]'` (`sqlite-query-translator.ts:906`).
- `find()` interpolates `` ` LIMIT ${options.limit}` `` and `` ` OFFSET ${options.skip}` `` (`sqlite-collection.ts` in `find`), bypassing the parameterized `translateOptions()`, which is dead in production paths.

Repro results:
- Filter key `x') IS NULL OR 1=1 OR jsonb_extract(body,'$.x` with value `"zzz"` → **returned all 4 documents**.
- `$index: { index: "0]') OR 1=1 OR json_extract('[1]','$[0", condition: "zzz" }` → **returned all 4 documents**.
- `limit: "0 UNION SELECT ..."`: the payload reached the SQL parser ("LIMIT clause should come after UNION"), which proves it was interpolated.

TypeScript types restrict keys at compile time only. Any key or value that comes from JSON, HTTP query params or a sort parameter is attacker-controlled at runtime.

**Fix:** introduce a single `FieldPath` resolver used by every SQL builder. It should:
1. Validate each segment against `^[A-Za-z_][A-Za-z0-9_]*$` (or allow-list known schema paths) and throw `QueryError` otherwise.
2. Bind the JSON path as a parameter: `jsonb_extract(body, ?)` with `'$.a.b'` as the value.
3. Quote generated-column identifiers (`"_name"`).
4. Coerce `limit`, `skip` and `$index.index` with `Number.isSafeInteger(x) && x >= 0`, else throw, and bind them as parameters.

Delete or reuse `translateOptions()` so that only one options path exists.

#### A2 — Unknown operators are silently ignored, so filters can match everything · **Critical** · [Repro][Code]
`translateSingleOperator` ends with `default: return null // Unknown operator - ignore` (`sqlite-query-translator.ts:~697`). When every operator in a condition is unknown, that condition disappears from the `WHERE` clause. Repro: `deleteMany({ role: { $eqq: "admin" } })` → `{ deletedCount: 4 }`, leaving 0 documents remaining. The same applies to `find`, `count`, `updateMany` and the `findOneAnd*` methods. Plain non-`$` keys inside an operator object (e.g. `$elemMatch: { sku: "X" }`) are dropped the same way (see A12). `InvalidQueryOperatorError` exists in `errors.ts` but is **never thrown**.

**Fix:** throw `InvalidQueryOperatorError` for any unrecognized `$`-key, and validate operator value shapes (`$in` must be an array, and so on). Optionally add a `deleteMany({})` guard requiring an explicit `{ all: true }` option. This is a behavior change; note it in the changelog.

### 2.2 Concurrency & transactions

#### A3 — `updateOne` is not atomic: compare-and-swap races and lost updates · **Critical** · [Repro][Code]
`updateOne` (`sqlite-collection.ts:1114`) runs `await this.findOne(...)`, merges in JS, then runs `UPDATE ... WHERE _id = ?`. The `await` gives other callers a turn in between.

- **CAS race:** two concurrent `updateOne({ jobId, status: { $in: ["pending"] } }, { status: "running" })` calls → `{"bothWon": true}`. The `UPDATE` re-checks only `_id`, not the original filter.
- **Lost update:** concurrent `updateOne(id, { a: 1 })` and `updateOne(id, { b: 2 })` → the final document is `{ b: 2 }`, and `a` is lost.

> **agentx impact:** `infra/src/stores/trade-jobs.ts` `transition()` uses exactly this conditional-`updateOne` pattern as its state-machine guard. Two workers or retries can both move a job out of `pending`, which risks **duplicate order placement**.

**Fix:** make the read-modify-write a single SQLite statement:
`UPDATE t SET body = jsonb_patch(body, jsonb(?)), updatedAt = ? WHERE _id = (SELECT _id FROM t WHERE <filter> LIMIT 1) AND <filter> RETURNING _id, json(body)`.

Alternatively, run the whole find-merge-validate-write sequence synchronously inside one `db.transaction()` with no `await`. `jsonb_patch` has RFC 7396 semantics (`null` deletes a key); decide and document whether that is the intended behavior or keep the JS merge inside the sync transaction. Apply the same treatment to `replaceOne`, `findOneAndUpdate`, `findOneAndReplace` and `findOneAndDelete`.

#### A4 — Transactions: can't nest, capture unrelated work, and leak events · **High** · [Repro][Code]
- `updateMany` (`sqlite-collection.ts:1634`) and `deleteMany` (`:1701`) issue their own `BEGIN TRANSACTION`. `insertMany` did work inside `execute()` in the repro. Repro: `db.execute(() => c.deleteMany(...))` → **`cannot start a transaction within a transaction`**. This likely explains why agentx never uses transactions.
- `Strata.execute()` (`stratadb.ts:191`) runs `BEGIN`, then `await fn(tx)`. Every other async operation on the same connection during that window becomes part of the transaction. Repro: a write made *outside* `execute()` while it was pending was **rolled back** when `execute()` failed.
- Events are emitted immediately, even inside a transaction that later rolls back. Repro: `{ events: 1, rowsAfterRollback: 0 }`.
- `transaction().collection(name, schema)` ignores `CollectionOptions`.

**Fix:** use SAVEPOINT-based nesting, either through `db.transaction()` or a depth counter with `SAVEPOINT sp_n`. Serialize `execute()` behind an async mutex so outside writes queue until the transaction finishes, and document that. Buffer events during a transaction, flush them on the outermost commit, and drop them on rollback.

#### A5 — Promise-returning methods throw synchronously · **High** · [Repro][Code]
`withRetry` returns `operation()` directly when retries are 0 or undefined (`retry-utils.ts:~97`). The default is no retries. Operation callbacks are synchronous and wrap their result with `Promise.resolve(...)`. Any throw (SQL error, validation, listener error) therefore escapes **synchronously** from `find`, `insertOne` and the other methods. Repro: `try { c.insertOne(...) } catch` caught it synchronously, and `c.find(badFilter)` threw synchronously. Code written as `c.find(x).catch(...)` crashes the process instead. When retries are *enabled*, p-retry turns the same error into a rejection. **Behavior therefore differs between agentx's dev setup (0 retries) and production (1 retry).**
**Fix:** make every public method `async`, or wrap with `Promise.try(operation)`. Add a test asserting that each public method always returns a promise and never throws synchronously.

#### A6 — Listener exceptions fail an already-committed write · **High** · [Repro][Code]
`emitEvent` calls `EventEmitter.emit` inline, after the write. A throwing `insert` listener made `insertOne` throw even though the row was **committed** (`count` = 1). The caller sees a failure for a write that succeeded, and retry wrappers may then duplicate it.
**Fix:** isolate listeners. Wrap each in try/catch and route failures to an `'error'` event or an `onListenerError` option, or dispatch with `queueMicrotask`. Document the delivery guarantees: after commit, synchronous or asynchronous, at-most-once.

### 2.3 Documented features that don't work

#### A7 — Automatic retry never triggers on real SQLite errors · **High** · [Repro][Code]
`isRetryableError` (`retry-utils.ts:69`) matches `typeof error.code === "number"` against `[5, 6, 7, 10]`. Bun's `SQLiteError` has `code: "SQLITE_BUSY"` (a **string**) and `errno: 5`. For a unique violation it's `code: "SQLITE_CONSTRAINT_UNIQUE"`, `errno: 2067` (an extended code). `ConnectionError` and `TransactionError`, the other retry triggers, are **never thrown** anywhere in `src/`. The retry layer is therefore effectively dead. The unit tests mask this by faking `Object.assign(new Error(), { code: 5 })` (`test/unit/retry-utils.test.ts:289+`).

> **agentx impact:** `infra/src/db.ts` enables 1 retry in production, which does nothing.

This is **not** a Bun regression: `code` has been a string since Bun v1.0.21 (§1B-B1).
**Fix:** classify by `errno & 0xff` (the primary result code), so extended codes such as `SQLITE_BUSY_SNAPSHOT` (517) also count. Don't rely on `code` for generic errors: it is `undefined` before Bun 1.4. Wrap raw `SQLiteError`s into StrataDB error classes at one boundary (see A19). Test with a real `BEGIN IMMEDIATE` lock across two connections (Appendix A, `busy.ts`).

#### A8 — `compoundIndex()` is never created in SQLite · **High** · [Repro][Code]
The builder stores `compoundIndexes` on the schema (`collection-builder.ts:198`). `SQLiteCollection` never reads them: `sqlite-collection.ts` has no reference to "compound". Repro: after `.compoundIndex("a_b", ["a","b"], { unique: true })`, `sqlite_master` shows only `sqlite_autoindex_t_1` and `idx_t_a`, and **a duplicate `(a, b)` insert was accepted**. Tests only assert the schema metadata (`test/unit/nested-fields.test.ts:250-254`).

> **agentx impact:** five compound indexes declared (signal notifications ×2, history ×2, `type_name`) do not exist. None are `unique`, so the cost is query performance, not correctness.

**Fix:** create them as expression indexes: `CREATE [UNIQUE] INDEX IF NOT EXISTS "idx_t_a_b" ON "t"("_a", jsonb_extract(body, '$.b'))`, reusing the A1 resolver. Add an integration test that inspects `PRAGMA index_list` and, for unique indexes, asserts that a duplicate insert throws `UniqueConstraintError`.

#### A9 — `timestamps(false)` is ignored · **Medium** · [Repro][Code]
Repro: a schema with `.timestamps(false)` still produced documents with `createdAt` and `updatedAt` keys. `sqlite-collection.ts` never reads `schema.timestamps`. In addition, `updateOne` writes `updatedAt` into the JSON body as well as the column (the merged doc minus `_id` is stringified), so the timestamps are stored twice.
**Fix:** honor the flag by omitting the fields from returned documents (the columns can stay). Never write timestamp fields into `body`.

> **agentx impact:** `signal-notification-schema.ts` and `history-schema.ts` rely on `timestamps(false)`.

#### A10 — No schema evolution: adding an indexed field breaks existing databases · **High** · [Repro][Code]
`CREATE TABLE IF NOT EXISTS` is a no-op on an existing table, so new generated columns are never added. Repro: opening an existing collection with an extra indexed field, then querying it → **`no such column: _name`**. A schema migration system is listed in `ROADMAP.md` (v2.0), but the minimal case is a bug today, not a missing feature.
**Fix:** on collection open, diff `PRAGMA table_xinfo` against the schema. `ALTER TABLE ... ADD COLUMN "_x" ... GENERATED ALWAYS AS (...) VIRTUAL` is supported by SQLite for VIRTUAL columns. Then create any missing indexes. Report removed or changed fields through an option or a warning instead of failing silently.

### 2.4 Query semantics

#### A11 — `null` and `$ne` semantics are wrong · **High** · [Repro][Code]
`translateFieldCondition` emits `field = ?` with `null` bound, so `= NULL` never matches. Repro: `find({ nick: null })` → `[]`, expected `alice`; `{ nick: { $ne: null } }` → `[]`, expected `bob`. `$ne: "B"` also excludes every document whose field is null or missing, because of SQL three-valued logic. MongoDB would return them. This is the known skip at `test/integration/complex-queries.test.ts:793`.
**Fix:** `null` → `IS NULL`. `$ne: null` → `IS NOT NULL`. `$ne: v` → `(field IS NULL OR field <> ?)`, or document that StrataDB intentionally differs. Decide whether `null` matches missing fields (MongoDB: yes) and document the answer.

#### A12 — `$elemMatch` fails on arrays of objects · **Medium** · [Repro][Code]
`translateElemMatchOperator` treats every key as an operator against `json_each.value`. Field keys such as `sku` hit the `default: null` branch, leaving `WHERE ` empty → **`near ")": syntax error`** for both `{ sku: "X" }` and `{ qty: { $gte: 2 } }`. This is the known skip at `complex-queries.test.ts:358`.
**Fix:** treat non-`$` keys as sub-paths, `json_extract(json_each.value, '$.sku')` (with the path bound per A1), and recurse with the normal field-condition translator.

#### A13 — LIKE family: case and wildcard semantics · **Medium** · [Repro][Code]
- SQLite's `LIKE` is case-insensitive for ASCII by default. Repro: `$like: "ALICE"` matched `alice`, so `$like` and `$ilike` behave identically. `COLLATE NOCASE` after the pattern has no effect on `LIKE`.
- `search({ caseSensitive: true })` is ignored. Repro: `"ABC"` matched `"abc"`.
- `$contains`, `$startsWith`, `$endsWith` and `search` don't escape `%`/`_`. Repro: `$startsWith: "_"` matched all 4 documents.

**Fix:** escape the user text (`replace(/[\\%_]/g, "\\$&")` plus `ESCAPE '\'`). For case-sensitive matching use `instr()` or `substr()` comparisons, or `GLOB` with escaped metacharacters. On Bun ≥ 1.4.4, `db.function()` UDFs can provide Unicode-aware folding and a `$regex` operator (§1B-B2), at the cost of index use. Keep `LIKE` for the case-insensitive variants. Document Unicode case-folding limits (`NOCASE` and `LIKE` fold ASCII only).

#### A14 — `skip` without `limit` is a SQL syntax error · **Medium** · [Repro]
Repro: `find({}, { skip: 1 })` → `near "OFFSET": syntax error`. SQLite requires `LIMIT` before `OFFSET`.
**Fix:** emit `LIMIT -1 OFFSET ?` when only `skip` is set.

#### A15 — Cursor pagination edge cases · **Medium** · [Repro][Code]
- An unknown cursor id is silently ignored and returns the **first page**. Repro: `["1"]`. Clients can loop forever.
- Only the first sort key participates in the cursor predicate (`buildCursorClause`), so multi-key sorts paginate incorrectly.
- NULL sort values are dropped, because `NULL > ?` is never true.
- `ORDER BY` has no implicit `_id` tie-breaker, although the cursor predicate assumes `(sortCol, _id)` ordering.

**Fix:** throw `QueryError` (or return an `invalidCursor` signal) for unknown cursors. Build a full lexicographic tuple comparison across all sort keys plus `_id`. Always append `_id` to `ORDER BY` when `cursor` is used. Define NULL ordering (`NULLS FIRST`/`LAST`).

#### A16 — Unquoted identifiers break legal names · **Medium** · [Repro][Code]
Repro: collection `"order"` → `near "order": syntax error`. Collection `"user-data"` → `near "-": syntax error`. Indexed dotted fields (e.g. `"profile.city"`) would produce the column `_profile.city`.
**Fix:** quote all identifiers (`"…"`, escaping `"` as `""`). Map dotted paths to safe column names (e.g. `_profile__city`). Validate collection names at `collection()` time with a clear `SchemaValidationError`.

### 2.5 Events & errors

#### A17 — Event payloads are too thin for consumers · **Medium** · [Repro][Code]
- `DeleteEvent` is `{ filter, deleted }`. Repro: `{"filter":{"a":"y"},"deleted":true}`. It has no `_id` and no document.
- `deleteMany` emits only `deleteMany`, with no per-document `delete` events, and `updateMany` does the same for updates.
- `UpdateEvent.document` is `T | null`, even for `update` events that only fire after a successful update.

> **agentx impact:** `server/src/routes/sse.ts` works around this with `typeof e.filter === 'string' ? e.filter : undefined`. That loses ids for object-filter deletes, and it misses `deleteMany` entirely.

**Fix:** use `RETURNING _id` (and optionally `json(body)`) on deletes and updates. Add `ids: string[]` to the `*Many` events and `_id`/`document` to `DeleteEvent`. Narrow `UpdateEvent.document` to `T` when `upserted` is false and the update succeeded.

#### A18 — `removeAllListeners()` with no argument removes nothing (2 failing tests) · **Medium** · [Repro][Code]
`removeAllListeners(event?)` forwards `event` as `this._emitter.removeAllListeners(event)` (`sqlite-collection.ts:2184`). Node-compatible `EventEmitter` only clears all events when called with **no arguments**. An explicit `undefined` is treated as an event name. Repro: after `removeAllListeners(undefined)`, `listenerCount` = 1. This causes the two failing tests in `test/unit/collection-events.test.ts` (lines ~288 and ~1666). `Strata.close()` is unaffected, because `cleanupEvents()` calls it with no arguments. **The trigger is Bun 1.4's Node-compatible `node:events` (§1B-B1):** the same tests pass 97/97 on Bun 1.3.6. The code relied on non-Node behavior, so the fix is correct on both versions.
**Fix:** `event === undefined ? e.removeAllListeners() : e.removeAllListeners(event)`.

#### A19 — Error taxonomy mostly unused; raw `SQLiteError` leaks · **Medium** · [Code][Measured]
Of the 12 exported error classes, only `ValidationError` (10 sites), `UniqueConstraintError` (2), `AbortedError` (3) and `QueryError` (1) are thrown. **Never thrown:** `SchemaValidationError`, `InvalidQueryOperatorError`, `TypeMismatchError`, `DatabaseError`, `ConnectionError`, `ConstraintError`, `TransactionError`, `TransactionAbortedError`. SQL errors such as syntax errors, missing columns and locks surface as Bun's raw `SQLiteError`. `errors.ts` has 63.6% line coverage.

> **agentx impact:** `infra/src/stores/error-mapping.ts` maps `ConnectionError`, `TransactionError` and `QueryError` to `database_error`. In practice everything falls through to its "unknown error" branch.

**Fix:** add one `wrapSqliteError(err, context)` boundary that maps `errno` to a class: BUSY/LOCKED → `ConnectionError` or `TransactionError` (retryable), CONSTRAINT_* → `ConstraintError`/`UniqueConstraintError`, ERROR → `QueryError`, and attach `{ sql, collection, operation, errno }`. Either use or remove the dead classes. Removal is a breaking change, so prefer using them.

### 2.6 API ergonomics & typing

#### A20 — Schema field names aren't type-checked · **Low** · [Code]
`field<K extends keyof T | string>(name: K, …)` (`schema-builder-types.ts:85`) accepts any string, so `.field("emial", …)` compiles. The same applies to `compoundIndex` field lists.
**Fix:** constrain to `keyof T | DocumentPath<T>` (the `Paths` helper already exists), keeping a typed escape hatch.

#### A21 — `db.collection(name, schema)` returns a cached instance even if the schema differs · **Low** · [Code]
`stratadb.ts` returns `existing` when the name is already registered, without comparing schemas. A second caller with a different schema silently gets the first one. There are also two creation styles (the `collection(name)` builder vs. `createSchema()`), with slightly different option plumbing (the builder path passes `enableCache` but no retry defaults).
**Fix:** throw (or warn) on a schema mismatch for the same name. Route both creation paths through one factory so options are consistent.

#### A22 — Feature gaps surfaced by agentx · **Low (feature)**
- **Update operators:** `updateOne` is merge-only. There is no `$set`, `$unset`, `$inc` or `$push`, so an atomic counter or array append is impossible without a read-modify-write (which A3 makes racy).
- **Read-only mode:** agentx's `reference-db.ts` relies on DDL being a harmless no-op on a read-only file. Add `new Strata({ database, readonly: true })` to skip DDL and refuse writes with a clear error.
- **Projection pushdown:** see P3.

---

## 3. Quality & Testing

### Q1 — Current state
- 715 tests: **710 pass / 2 fail / 3 skip** (Bun 1.4.4). The failures are A18.
- The 3 skips are TODOs: `$elemMatch` (A12), "projection with complex queries" (`complex-queries.test.ts:685`), and null vs. undefined (A11). In this audit, simple projection (`{ name: 1 }` → `["_id","name"]`) **worked**, so the projection skip may be stale. Re-evaluate it.
- Type tests (`tsd`, 4 files) pass. `tsd` bundles its own TypeScript (`@tsd/typescript`), so it **doesn't verify the TS 6/7 versions consumers use**, and `test:types` requires a full build.

### Q2 — No CI quality gate · **High**
`.github/workflows/` has only `deploy-docs.yml`, which uses `bun-version: latest`. The lefthook `pre-push` test hook is commented out with "TODO: Uncomment when tests are implemented". The `prepare` script runs `check` + `build` on every install, which is slow for contributors and runs for git-URL installs, while nothing gates merges.
**Fix:** add a `ci.yml` that runs `bun install --frozen-lockfile` → typecheck (**TS 7.0 primary**, plus 6.0 and 5.9 for consumer compatibility, plus 7.1-beta non-blocking; §1A) → lint → `bun test --coverage` → build → type tests → pack smoke (Q8). Use a Bun matrix of {floor (§1B-B4), latest} × {`ubuntu-latest`, `macos-latest`}. The macOS leg matters because macOS uses the system SQLite (§1B-B3). Enable the pre-push test hook. Reduce `prepare` to `lefthook install`.

### Q3 — High coverage, missing behavioral test classes · **High**
97% line coverage didn't catch A1–A18, because those failures need specific inputs, interleavings and real SQLite errors rather than more lines executed. Add these suites. Every Appendix A repro converts directly into a regression test.

| Suite | Covers | Notes |
|---|---|---|
| `security/identifier-injection.test.ts` | A1, A16 | Fuzz filter/sort/search keys, `$index`, `limit`/`skip` with a payload corpus; assert `QueryError`, never extra rows. |
| `query/strict-operators.test.ts` | A2 | Every method rejects unknown `$ops` and malformed operator values. |
| `concurrency/atomic-updates.test.ts` | A3 | `Promise.all` CAS and lost-update cases across `updateOne`, `replaceOne` and the `findOneAnd*` methods. |
| `transactions/nesting.test.ts` | A4 | Every write method inside `execute()`; nested `execute()`; outside writes during a pending transaction; events on rollback. |
| `contract/promise-only.test.ts` | A5 | For every public async method with a bad input: returns a promise and rejects, never throws synchronously. |
| `events/listener-isolation.test.ts` | A6, A17, A18 | Throwing listeners; payload contents for every event; `removeAllListeners()` without arguments. |
| `retry/real-sqlite-busy.test.ts` | A7 | Two `Database` handles on one temp file with `BEGIN IMMEDIATE`; assert the retry happens and a typed error is thrown. **Replace the fake numeric-code unit tests.** |
| `schema/ddl.test.ts` | A8, A9, A10, A16 | Inspect `PRAGMA table_xinfo` and `index_list`; unique compound rejects duplicates; `timestamps(false)`; reopen with an added indexed field. |
| `query/semantics.test.ts` | A11–A15 | null, `$ne`, `$elemMatch` on objects, LIKE escaping and case, `skip` without `limit`, cursor edge cases. |
| `errors/mapping.test.ts` | A19 | Each SQLite failure class maps to the right StrataDB error with context. |

### Q4 — Property and differential testing · **Medium**
The query translator is a good fit for property-based tests (`fast-check`). Generate random filters over a small schema, run them through StrataDB, and compare against a naive in-memory JS evaluator of the same semantics. Differences would catch A2, A11 and A13-type bugs automatically.

### Q5 — Mutation-sensitive gaps · **Low**
`errors.ts` (63.6%) and the `$index` operator-condition branch (`sqlite-query-translator.ts:906-952`) are the least-covered code. Add direct tests or delete the dead paths.

### Q6 — Type-test tooling · **Low**
Replace `tsd`, which is pinned to its bundled TS 5.9.3 and needs a build first, with `expect-type` assertions checked by the project's own `tsc`. That works unchanged on TS 7.0, which has no classic compiler API, and on the 6.0/5.9 matrix legs (§1A). Add type tests for the A20 constraints and the A17 payload narrowing.

### Q7 — Benchmarks aren't regression-tracked · **Low**
`bench/*.bench.ts` (mitata) exist, but nothing compares them over time. Add a CI job that is non-blocking, or runs manually, and posts results, so P1/P3 improvements and regressions are visible.

### Q8 — Consumer smoke test · **Medium**
Run `bun pm pack`, install the tarball into a temp fixture with **only** production dependencies, then typecheck it with TS 7.0 and 6.0 under `skipLibCheck: false`, with a current `@types/node`, and run a CRUD script. This was done manually during this audit for TS 7 (§1A). This catches D1, D2 and D6-class publishing defects.

---

## 4. Performance & Chores

### 4.1 Performance

#### P1 — Every operation re-prepares its SQL statement · **High** · [Measured][Code]
`sqlite-collection.ts` has 13 `this.db.prepare(...)` sites and 0 uses of `db.query()`. Micro-benchmark, `findOne` by indexed field, ×50,000, Bun 1.4.4:

| Path | Time | Per op |
|---|---|---|
| StrataDB `findOne` | 171 ms | 3.4 µs |
| Raw `db.prepare()` each call (+ `JSON.parse`) | 134 ms | 2.7 µs |
| Raw cached `db.query()` (+ `JSON.parse`) | **30 ms** | **0.6 µs** |

Re-preparing accounts for about 60% of StrataDB's per-call cost on point reads: (134 − 30) / 171 ms.
**Fix:** a bounded **per-collection LRU of `prepare()`d `Statement`s** keyed by SQL. Don't rely on `db.query()`: Bun's cache defaults to 20 entries per connection, and its size knob `Database.MAX_QUERY_CACHE_SIZE` is a process-wide static (§1B-B2). Because A1 moves field paths into bound parameters, SQL text becomes far more cacheable, so the two fixes reinforce each other. Finalize statements on `close()`/`drop()`.

#### P2 — Translator cache is redundant once statements are cached · **Low** · [Code]
`SQLiteQueryTranslator` keeps an opt-in SQL-string cache (`enableCache`, default **off**), with a `stringify`-based cache key and a `containsNonCacheableOperators` scan. After P1 it adds complexity for little gain. Benchmark it after P1 and either remove it or make it the default, using the statement cache as the single cache layer.

#### P3 — Projection runs in JS after full parsing · **Medium** · [Code]
`find()` runs `SELECT _id, json(body)` and `JSON.parse`s the whole document, then `applyProjection` drops fields. For wide documents with narrow projections, build `json_object('a', jsonb_extract(body,'$.a'), …)` in SQL instead, keeping the JS path for exclusion projections. Measure with `bench/crud-operations.bench.ts` before and after.

#### P4 — Read-modify-write updates cost 2 statements and a JS deep merge · **Medium** · [Code]
`updateOne` = `findOne` + `deepmerge` + `stringify` + `UPDATE` + a re-prepare. The SQL-side `UPDATE … SET body = jsonb_patch(body, jsonb(?)) … RETURNING` from A3 is a single statement and also fixes atomicity. This may let you drop `deepmerge-ts` (D3) if RFC 7396 semantics are acceptable.

#### P5 — `insertMany` / `updateMany` use hand-written transactions · **Low** · [Code]
Switch to `db.transaction(fn)` (A4). It's both faster to write correctly and nest-safe. Keep the per-row prepared statement, but cache it (P1).

### 4.2 Code hygiene & chores

| ID | Item | Location | Action |
|---|---|---|---|
| C1 | Field-path SQL logic duplicated in 5 places | translator `resolveFieldName`; collection `buildSearchClause`, `buildSortClause`, `buildCursorClause`, `createTable`/`createIndexes` | Consolidate into one `FieldResolver` (A1). |
| C2 | Two options paths; `translateOptions()` unused by `find()` | `sqlite-query-translator.ts:1028`, `find()` | Keep one parameterized path. |
| C3 | `sqlite-collection.ts` is 2,204 lines | — | Split into `ddl.ts`, `read-ops.ts`, `write-ops.ts`, `events.ts` and `sql-builders.ts` after the fixes land, not before (to avoid merge conflicts with them). |
| C4 | `@ts-expect-error` ×5 and `biome-ignore` complexity suppressions | `sqlite-collection.ts:166,1455,2157…` | Typed emitter facade (D7); refactor `insertMany`. |
| C5 | `DESIGN.md` duplicated: root (4,039 lines) and `docs/DESIGN.md` (4,047 lines), already diverged | repo root, `docs/` | Keep the `docs/` copy; delete the root copy or make it a link. |
| C6 | Root-level design leftovers | `COLLECTION_EVENTS_DESIGN.md`, `.github/copilot-instructions.md` (658 lines) | Move into `docs/design/` or archive. Check that the agent instructions match the post-fix behavior. |
| C7 | README claims that don't hold | "Automatic Retries" section, `compoundIndex`/`timestamps` docs, `$like` vs `$ilike`, `caseSensitive` | Update after the fixes; add a "Semantics vs. MongoDB" page (null, `$ne`, LIKE, Unicode). |
| C8 | `prepare` script does `check && build` on install | `package.json` | Replace with `lefthook install`; put `check` in CI. |
| C9 | `@types/bun: "latest"` | `package.json` | Pin it. |
| C10 | No release automation or tags | — | Tag `v0.5.0` retroactively. Add changesets or release-please. Publish with provenance. Keep Keep-a-Changelog. |
| C11 | Docs workflow uses `bun-version: latest` | `deploy-docs.yml` | Pin it, or align it with the CI matrix. |

---

## 5. Action Plan / Roadmap

> **Process note for the implementing agent:** this repo tracks work with the Backlog.md CLI (see `CLAUDE.md`). Create each task below with `backlog task create … --ac …`; never edit task files directly. The task IDs here (`SDB-xx`) are suggestions. Map them to Backlog IDs on creation, preserving the dependency order. Every bug-fix task starts by turning its Appendix A repro into a failing test.

### Release strategy

| Release | Theme | Compatibility |
|---|---|---|
| **0.5.1** (optional, fast) | Guardrails, TS 7 toolchain, zero-risk fixes (Phase 0) | Non-breaking for consumers: the published JS and `.d.ts` stay usable on TS 5.9–7.x. **Raising `engines.bun` (SDB-00) waits for 0.6.0.** |
| **0.6.0** | Safety & correctness (Phase 1) | **Intentional behavior changes:** unknown operators throw, null semantics, rejections instead of synchronous throws, quoted identifiers, events deferred inside transactions. Document each one in a "Breaking changes" section. |
| **0.7.0** | DX, schema evolution, events, performance (Phases 2–3) | Mostly additive |

Pre-1.0 semver allows breaking changes in a minor version. Bundling them all into a single 0.6.0 gives consumers one migration instead of several.

### Phase 0 — Guardrails (do first; unblocks everything) → 0.5.1

| ID | Task | Fixes | Acceptance criteria |
|---|---|---|---|
| SDB-00 | **Decide the Bun floor** (with the agentx owner) | §1B-B4 | Decision recorded: `>=1.4.4` (recommended, coordinated with agentx's Bun 1.3.14 → 1.4.4 bump) or `>=1.3.14` with feature detection. |
| SDB-01 | Add CI quality gate | Q2, C8, C11 | `ci.yml` runs frozen install → typecheck (TS 7.0 primary; 6.0 and 5.9 compatibility; 7.1-beta non-blocking) → lint → test + coverage → build → type tests on Bun {floor, latest} × {ubuntu, macos}; pre-push runs `bun test`; `prepare` = `lefthook install`. |
| SDB-02 | **Migrate the toolchain to TypeScript 7.0** | D2, D4, §1A | `typescript@~7.0.2`; `"types": ["bun"]`; `"isolatedDeclarations": true` with `deep-merge.ts:70` annotated; `tsdown@^0.23.7` with `dts: { generator: "oxc" }` and `deps.neverBundle` (no deprecation warnings); output filenames and `exports` unchanged (or `fixedExtension: true`); `@types/bun@1.4.4` and `@types/node@^26` pinned; `tsc` 7 reports 0 errors. |
| SDB-02a | Type tests without `tsd` | Q6, §1A | `test/type/*` rewritten with `expect-type`, checked by the project `tsc` on every CI TS leg; `tsd` removed. |
| SDB-02b | Docs build on TS 7 | §1A | `docs:build` runs TypeDoc in a separate docs package pinned to `typescript@~6.0` and still produces the VitePress API pages; a tracking note to remove the workaround when TypeDoc supports TS 7. |
| SDB-03 | Fix `removeAllListeners()` without argument | A18, §1B-B1 | Both currently failing tests pass on Bun 1.4.4 *and* on the floor version; the full suite is green on both. |
| SDB-07 | SQLite version guard | §1B-B3 | `new Strata()` throws a typed error naming `Database.setCustomSQLite()` when `sqlite_version()` < 3.45.0; README documents the requirement; tested by stubbing the version query. |
| SDB-08 | Bun 1.4 behavior audit fixes | §1B-B1 | `$index` condition goes through `toBindValue` (no raw `TypeError` for `Date`); `changes` semantics documented; using a collection after `close()` throws a StrataDB error, not "Statement has finalized". |
| SDB-04 | Fix published type dependency | D1, D6 | `type-fest` moved to `dependencies` (or its types inlined); `license`, `repository`, `homepage`, `bugs`, `keywords`, `engines.bun` and `sideEffects:false` added; source-map strategy decided. |
| SDB-05 | Consumer pack smoke test | Q8 | A CI job packs, installs into a fixture with prod deps only, typechecks under TS 7.0 and 6.0 with `skipLibCheck:false`, and runs a CRUD script. |
| SDB-06 | Retry classification by `errno` | A7 | A real two-connection `SQLITE_BUSY` test is retried and succeeds after the lock is released; fake numeric-code tests are replaced. |

### Phase 1 — Safety & correctness → 0.6.0 (release-blocking)

| ID | Task | Fixes | Depends on | Acceptance criteria |
|---|---|---|---|---|
| SDB-10 | Single `FieldResolver` + identifier validation/quoting | A1, A16, C1, C2 | SDB-01 | All five SQL builders use it; JSON paths bound as parameters; `limit`, `skip` and `$index` validated and bound; table/column identifiers quoted; `"order"` and `"user-data"` collections work; the injection corpus test passes (no extra rows; `QueryError` thrown). |
| SDB-11 | Strict operator validation | A2 | SDB-10 | Unknown `$op` → `InvalidQueryOperatorError` in every method; malformed operator values rejected; the `deleteMany` typo repro deletes 0 rows and throws. |
| SDB-12 | Promise-only error delivery | A5 | — | Every public async method is `async` or `Promise.try`-wrapped; the contract test proves no synchronous throws with retries both on and off. |
| SDB-13 | Atomic single-document writes | A3, P4, A9 (body timestamps) | SDB-10 | `updateOne`, `replaceOne` and `findOneAnd*` run as a single statement or a sync transaction; both concurrency repros pass (exactly one CAS winner; no lost update); timestamps no longer written into `body`. |
| SDB-14 | Nest-safe transactions | A4, P5 | SDB-12 | All batch operations work inside `execute()`; nested `execute()` uses SAVEPOINTs; writes outside a pending `execute()` are serialized and not rolled back; events are buffered until the outermost commit and dropped on rollback. |
| SDB-15 | Listener isolation | A6 | SDB-14 | A throwing listener no longer fails the write; the error goes to an `'error'` event or `onListenerError`; delivery semantics documented. |
| SDB-16 | Error-mapping boundary | A19 | SDB-06 | All `SQLiteError`s are wrapped by `errno` into StrataDB classes with `{ sql, collection, operation, errno }`; every exported class is thrown somewhere or deprecated; `errors.ts` coverage ≥ 90%. |
| SDB-17 | Implement compound indexes | A8 | SDB-10 | Indexes appear in `PRAGMA index_list`; a unique compound rejects duplicates with `UniqueConstraintError`; works with dotted paths. |
| SDB-18 | Honor `timestamps(false)` | A9 | SDB-13 | Documents from such schemas have no `createdAt`/`updatedAt` keys. |
| SDB-19 | Null and `$ne` semantics | A11 | SDB-11 | The skipped null test is enabled and passes; semantics documented on the "vs MongoDB" page. |
| SDB-20 | LIKE family correctness | A13 | SDB-10 | Wildcards escaped; `$like` is case-sensitive or explicitly documented otherwise; `$ilike` and `search.caseSensitive` behave as named; tests for `%`, `_` and `\`. |
| SDB-21 | `skip` without `limit` | A14 | SDB-10 | `find({}, { skip: 1 })` returns n−1 documents. |
| SDB-22 | 0.6.0 release | C7, C10 | all above | CHANGELOG "Breaking changes" section; README retries, indexes and semantics sections corrected; tag + provenance publish. |

### Phase 2 — DX, schema evolution & events → 0.7.0

| ID | Task | Fixes | Acceptance criteria |
|---|---|---|---|
| SDB-30 | Additive schema evolution | A10 | Reopening with new indexed fields adds VIRTUAL generated columns and indexes; removed or changed fields produce a warning or an option-controlled error; the reopen test passes. |
| SDB-31 | Rich event payloads | A17 | `DeleteEvent` has `_id` (+ optional `document`); `*Many` events carry `ids`; `UpdateEvent.document` narrowed; type tests updated. |
| SDB-32 | `$elemMatch` on object arrays | A12 | The skipped `$elemMatch` test is enabled and passes, including nested operators. |
| SDB-33 | Cursor pagination hardening | A15 | Unknown cursor → `QueryError`; multi-key tuple comparison; `_id` tie-breaker; defined NULL ordering; property test over random data/sorts shows no duplicates or gaps. |
| SDB-34 | Typed schema field names | A20 | `.field("typo")` fails to compile; dotted paths via `DocumentPath<T>`; escape hatch documented. |
| SDB-35 | Collection registry consistency | A21 | A schema mismatch on the same name throws; both creation paths share one factory with identical option handling. |
| SDB-36 | Update operators (`$set`, `$unset`, `$inc`, `$push`, `$pull`) | A22 | Translated to `jsonb_set`/`jsonb_remove`/`jsonb_insert` in a single statement; concurrent `$inc` ×100 yields +100. |
| SDB-37 | Read-only mode | A22 | `new Strata({ database, readonly: true })` skips DDL and rejects writes with a typed error. |
| SDB-38 | Property and differential query tests | Q4 | `fast-check` suite against an in-memory evaluator runs in CI with a fixed seed and a nightly random seed. |

### Phase 3 — Performance & chores (parallelizable with Phase 2)

| ID | Task | Fixes | Acceptance criteria |
|---|---|---|---|
| SDB-40 | Statement caching | P1, P2, §1B-B2 | Per-collection LRU of prepared statements (no dependence on, or mutation of, `Database.MAX_QUERY_CACHE_SIZE`); cache flushed after any DDL (SDB-30); `findOne` point-read benchmark ≥ 3× faster than v0.5.0 (baseline: 3.4 µs/op); statements finalized on `close()`/`drop()`; translator cache removed or justified by a benchmark. |
| SDB-41 | Projection pushdown | P3 | Inclusion projections built in SQL; benchmark shows improvement on wide documents; exclusion path unchanged. |
| SDB-42 | Runtime dependency upgrades | D3 | `deepmerge-ts@8` (or removed via SDB-13), `p-retry@9`, `@standard-schema/spec@1.1`; `fast-safe-stringify` evaluated or removed; suite green. |
| SDB-43 | Remaining toolchain upgrades | D4, D5 | Biome 2.6 / ultracite 8; commitlint 21; `platform`/`target` corrected, with output names verified (D5). (TS 7, tsdown and `@types/*` are done in SDB-02.) Move to TS 7.1 once it's GA, then re-evaluate TypeDoc and the tsgo d.ts generator. |
| SDB-47 | Optional `bun:sqlite` 1.4.4 features | §1B-B2 | `$regex` and Unicode-aware `$ilike` via `db.function()` (registered once per `Database`, `deterministic: true`); an opt-in change-capture mode using `onInsert`/`onUpdate`/`onDelete`, documented with its caveats (not commit-aware, skips truncate/replace, single hook per DB). |
| SDB-44 | Split `sqlite-collection.ts` and remove suppressions | C3, C4, D7 | No `@ts-expect-error` for emitter typing; no file > ~600 lines; no behavior change (suite + benchmarks identical). |
| SDB-45 | Docs and repo cleanup | C5, C6, C7 | Single `DESIGN.md`; design leftovers moved; "Semantics vs MongoDB" page; agent instructions updated to post-0.6 behavior. |
| SDB-46 | Benchmark tracking | Q7 | CI job (manual or nightly) publishes benchmark results as an artifact. |

### Downstream follow-ups for agentx (after StrataDB 0.6.0)

These belong in agentx's backlog, not StrataDB's, but they depend on the tasks above:
0. **Coordinated runtime and compiler bump:** Bun 1.3.14 → 1.4.4 (if SDB-00 picks the 1.4.4 floor), and `typescript ~6.0.3` → `~7.0.2`, replacing the `@typescript/native-preview` `tsgo` pin with `tsc` from `typescript@7`. Review Bun 1.4.0's breaking-changes list for agentx's own usage, including the `bun:sqlite` behavior changes in §1B-B1, which also apply to agentx's direct `bun:sqlite` use in `infra/src/db.ts`, `reference-db.ts` and `.scripts/create-db.ts`.
1. **Re-verify `trade-jobs.ts` `transition()`** after SDB-13. Until then, the conditional `updateOne` is not a safe compare-and-swap.
2. **Remove the `sse.ts` delete-id workaround** after SDB-31, and subscribe to `deleteMany`/`updateMany`.
3. **Re-check `infra/src/stores/error-mapping.ts`** against the real error classes after SDB-16.
4. **Production retry config** becomes effective after SDB-06. Review whether 1 retry with a 100–1000 ms timeout is the desired policy.
5. **Compound indexes** (5 declared) start existing after SDB-17. Expect a one-time index build on first open.
6. Consider `readonly: true` for `reference-db.ts` (SDB-37), and transactions for persist + enqueue in `server/src/work/processor.ts` (SDB-14).

---

## Appendix A — Reproduction scripts

The scripts live in the audit scratchpad and import `src/` directly, so they need no build: `/private/tmp/claude-501/-Users-takinprofit-Dev/239a07a4-30ee-4777-aea1-feeee3c1317b/scratchpad/strata/` (`repro.ts`, `repro2.ts`, `repro3.ts`, `repro4.ts`, `busy.ts`, `bench.ts`). The scratchpad is temporary, so the essential cases are reproduced below for conversion into regression tests.

```ts
import { Database } from "bun:sqlite"
import { Strata, createSchema, type Document } from "../src/index.ts"

type U = Document<{ name: string; role: string; nick?: string | null; items?: { sku: string; qty: number }[] }>
const db = new Strata({ database: ":memory:" })
const users = db.collection("users",
  createSchema<U>().field("name", { type: "TEXT", indexed: true }).field("role", { type: "TEXT" }).build())
await users.insertMany([
  { name: "alice", role: "admin", nick: null, items: [{ sku: "X", qty: 5 }] },
  { name: "bob", role: "user", nick: "B" },
  { name: "carol", role: "user" },
  { name: "50% off", role: "promo" },
])

// A1 injection: returns all 4 rows (expected: QueryError)
await users.find({ ["x') IS NULL OR 1=1 OR jsonb_extract(body,'$.x"]: "zzz" } as any)
// A1 $index injection: returns all 4 rows
await users.find({ items: { $index: { index: "0]') OR 1=1 OR json_extract('[1]','$[0" as any, condition: "zzz" } } } as any)
// A2 typo operator: deletedCount 4 (expected: InvalidQueryOperatorError)
await users.deleteMany({ role: { $eqq: "admin" } } as any)

// A11: [] (expected ["alice"]);  $ne null: [] (expected ["bob"])
await users.find({ nick: null }); await users.find({ nick: { $ne: null } })
// A12: SQL syntax error (expected ["alice"])
await users.find({ items: { $elemMatch: { sku: "X" } } } as any)
// A13: matches "alice" (case-insensitive $like);  "_" matches every row
await users.find({ name: { $like: "ALICE" } }); await users.find({ name: { $startsWith: "_" } })
// A14: near "OFFSET": syntax error
await users.find({}, { skip: 1 })

// A3 CAS race: both return non-null (expected exactly one)
type J = Document<{ jobId: string; status: string; a?: number; b?: number }>
const jobs = db.collection("jobs", createSchema<J>().field("jobId", { type: "TEXT", indexed: true, unique: true })
  .field("status", { type: "TEXT", indexed: true }).build())
const j = await jobs.insertOne({ jobId: "j", status: "pending" })
await Promise.all([
  jobs.updateOne({ jobId: "j", status: { $in: ["pending"] } }, { status: "running" }),
  jobs.updateOne({ jobId: "j", status: { $in: ["pending"] } }, { status: "running" }),
])
// A3 lost update: final doc lacks `a`
await Promise.all([jobs.updateOne(j._id, { a: 1 }), jobs.updateOne(j._id, { b: 2 })])

// A4: "cannot start a transaction within a transaction"
await db.execute(() => jobs.deleteMany({ status: "running" }))
// A4: a write outside a pending execute() is rolled back with it
const tx = db.execute(async () => { await Bun.sleep(10); throw new Error("fail") }).catch(() => {})
await jobs.insertOne({ jobId: "outside", status: "p" }); await tx // row is gone

// A5 + A6: insertOne throws SYNCHRONOUSLY, row is committed anyway
jobs.on("insert", () => { throw new Error("listener boom") })
try { jobs.insertOne({ jobId: "z", status: "p" }) } catch { /* reached synchronously */ }

// A7: Bun error shape — code is a string, errno is the number
const f = "/tmp/busy.db"; const a = new Database(f); a.run("CREATE TABLE IF NOT EXISTS t(x)"); a.run("BEGIN IMMEDIATE")
const b = new Database(f); b.run("PRAGMA busy_timeout=0")
try { b.run("INSERT INTO t VALUES (1)") } catch (e: any) { /* e.code === "SQLITE_BUSY", e.errno === 5 */ }

// A8 + A9: no compound index created; duplicate accepted; timestamps(false) ignored
type T = Document<{ a: string; b: number }>
const t = db.collection("t", createSchema<T>().field("a", { type: "TEXT", indexed: true })
  .compoundIndex("a_b", ["a", "b"], { unique: true }).timestamps(false).build())
db.sqliteDb.query("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='t'").all() // no idx for a_b
await t.insertOne({ a: "x", b: 1 }); await t.insertOne({ a: "x", b: 1 }) // accepted; docs have createdAt/updatedAt

// A10: reopen with a new indexed field -> "no such column: _name"
// A16: db.collection("order", schema) / db.collection("user-data", schema) -> syntax error
// A18: collection.removeAllListeners() leaves listeners attached
```

## Appendix B — Commands run

```bash
cd /Users/takinprofit/Dev/StrataDb
bun install --frozen-lockfile --ignore-scripts   # node_modules/ (git-ignored)
bun test                                          # 710 pass / 2 fail / 3 skip
bun test --coverage                               # 97.16% lines
bun run typecheck                                 # TS 5.9.3: clean
bunx -p typescript@6.0.3 tsc --noEmit -p tsconfig.json              # 56 errors
bunx -p typescript@6.0.3 tsc --noEmit -p tsconfig.json --types bun  # 0 errors
bun run lint                                      # clean
bun run build                                     # dist/ (git-ignored)
bunx tsd                                          # pass
bun outdated

# Toolchain on TypeScript 7 (in a throwaway copy with typescript@7.0.2, @types/bun@1.4.4)
bunx -p typescript@7.0.2 tsc --noEmit -p tsconfig.json              # 56 errors
bunx -p typescript@7.0.2 tsc --noEmit -p tsconfig.json --types bun  # 0 errors
tsdown (0.16.6)  # crash: no classic compiler API
tsdown (0.23.7)  # builds (tsgo generator, deprecation warning); dts.generator "oxc" also builds
typedoc (0.28.x) # crash on TS 7
tsc --isolatedDeclarations --declaration                            # 1 error (deep-merge.ts:70)

# Bun runtime comparison
bun-1.3.6 test   # 712 pass / 0 fail / 3 skip
bun-1.4.4 test   # 710 pass / 2 fail / 3 skip
# bun-types 1.3.2 -> 1.4.4: diff of sqlite.d.ts; sqlite_version() 3.54.0 on macOS 27.2 = /usr/bin/sqlite3
```

No tracked files in the StrataDB repo were modified (`git status --porcelain` is empty). `node_modules/` and `dist/` were created and are git-ignored.
