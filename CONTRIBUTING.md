# Contributing and releasing

Use Bun 1.4.4 or newer. Install with `bun install --frozen-lockfile`, then run:

```bash
bun run typecheck
bun run lint
bun test
bun run build
bun run test:types
bun run test:consumer
```

## Benchmark history

The `Benchmarks` workflow runs manually and Sundays at 03:45 UTC with Bun 1.4.4.
It runs `bun run bench:all` and uploads a `benchmarks-<sha>` artifact for 90 days.
`environment.txt` identifies the source revision, Bun, OS and SQLite versions.
`bench-all.txt` contains query/CRUD/batch means, ranges and percentiles; CRUD
fresh-database cases include setup and cleanup in their timed operation, while
shared read fixtures are seeded outside the timed callback. Runner errors fail
the job; a failure artifact can contain partial output and is not a valid baseline.

The separate `statement-cache.json` and `projection.json` files contain fixed
fixtures, warmup/iteration counts, five trial samples and medians. Compare the
same protocol on the same runtime, OS and hardware; inspect the sample spread
before interpreting small changes. Compare these JSON medians with their own
history, rather than means from a different CRUD workload.

Actions is currently billing-locked, so scheduled jobs cannot run. Reproduce
locally with `bun run bench:all`, `bun bench/statement-cache.bench.ts` and
`bun bench/projection.bench.ts`, recording the revision and environment. The
TASK-267 local baseline on Bun 1.4.4/Apple M5/macOS arm64 measured warm cached
translation 179.50 ns, findById 866.10 ns, indexed findOne 1.51 µs and atomic
findOneAndUpdate 6.24 µs (means). Fixed-protocol medians and before/after numbers
are retained in the performance task notes and the performance guide.

## Local CI when GitHub Actions is unavailable

The account currently has a GitHub Actions billing lock. Jobs cannot start, so
do not describe a local verification as a GitHub run. From the main checkout:

```bash
bash scripts/ci-local.sh <tag-or-branch>
bunx --bun actionlint
```

The script must print `RESULT: PASS`. It tests macOS on the host and Linux in
Docker, pinned and latest Bun, and TypeScript 5.9/6.0/7.0 with 7.1-beta advisory.
Docker/Colima must already be running. Preserve its result table and SHA in the
release PR. Update this script whenever the CI workflow's checks change.

## Differential query testing

`bun test` includes 500 fast-check cases with fixed seed `20261110`. The suite
compares real SQLite queries with an independent evaluator across indexed and
unindexed fields, cache on/off, nested/logical filters and scalar/array operators.
Each generated filter is repeated and its literals varied to exercise cache hits.

The nightly/on-demand `query-properties.yml` workflow selects and prints a random
seed. While Actions is locked, exercise that path locally with:

```bash
STRATADB_PROPERTY_RANDOM=1 bun test test/property/query-differential.test.ts
```

The output prints a replay command. To reproduce a failure, copy its seed:

```bash
STRATADB_PROPERTY_SEED=<seed> bun test test/property/query-differential.test.ts
```

Keep minimized counterexamples as ordinary focused regressions. Fix production
queries rather than changing the independent semantics or narrowing generators.

## One-time npm trusted-publisher setup

An npm package maintainer configures this on npmjs.com in **stratadb → Settings
→ Trusted publishing**. Select GitHub Actions and enter:

| Setting | Value |
| --- | --- |
| Organization or user | `g5becks` |
| Repository | `StrataDb` |
| Workflow filename | `release.yml` |
| Environment | Leave empty (the workflow declares no environment) |

Allow direct publishing for this publisher. Review the
[npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/)
when configuring it. This requires a GitHub-hosted runner, npm 11.5.1 or newer,
and Node 22.14 or newer; the workflow selects Node 24. It uses short-lived OIDC
credentials and requests provenance, without a stored npm credential.

`.github/workflows/release.yml` runs only on pushed `v*` tags. It checks out the
tag, checks its version against package.json, and completes all checks above
before consulting the registry. An already published version is a successful
skip. Registry errors other than a missing version fail the job. Publishing
remains unavailable while Actions is locked, even after publisher setup.

## Scripted local release preparation

On a clean `release/vX.Y.Z` branch with nonempty CHANGELOG `[Unreleased]`, run:

```bash
bun run release:prepare X.Y.Z --dry-run
bun run release:prepare X.Y.Z
```

Use a stable three-part version greater than package.json, with no existing tag.
The dry run performs preflight and prints its plan without writing files. The
real run rolls the changelog into a UTC-dated section, leaves `[Unreleased]`
empty, bumps package.json, commits with hooks, and creates an annotated tag.
It requires `scripts/ci-local.sh` to succeed and report `RESULT: PASS`, then
creates a detached worktree at `../StrataDb-release/vX.Y.Z` (override with
`--out /absolute/path` outside the source repo; the path must not exist).

The worktree retains the frozen install/build, tarball, `SHA512SUMS`,
`CI_LOCAL.log` and `RELEASE_NOTES.md`. The script validates archive entries and
runs CRUD from an isolated tarball consumer. It prints maintainer publication
commands; pushing refs, merging the release PR and publication are separate
steps. Failures stop preparation; inspect the error and retained commit/tag
before retrying. Existing tags and artifact directories are never overwritten.

We use a local script while GitHub Actions is unavailable. Changesets and
release-please add automation centered on Actions, and a single maintainer
does not need per-change changeset files. The script can be invoked by a
future workflow when Actions is available again.

## Manual publication by the maintainer

The release engineer prepares a verified tag worktree, tarball, SHA-512 digest,
and `RELEASE_NOTES.md` under `../StrataDb-release/vX.Y.Z`. Keep those artifacts.
Review the digest and archive contents (only `dist/`, `src/`, README, LICENSE,
and package.json), and verify an isolated consumer can install the tarball and
perform in-memory CRUD. The release engineer never publishes to npm.

After the release PR is merged and its tag is pushed, the maintainer runs:

```bash
cd ../StrataDb-release/vX.Y.Z
shasum -a 512 stratadb-X.Y.Z.tgz
npm publish ./stratadb-X.Y.Z.tgz --access public
npm view stratadb@X.Y.Z version
gh release create vX.Y.Z --verify-tag --title vX.Y.Z --notes-file RELEASE_NOTES.md
```

Manual npm publication requires interactive 2FA for every publish. Complete it
personally; do not give the release engineer credentials. If the automated
workflow later runs for an already published version, its registry guard skips
publication. Create the GitHub release only after verifying the npm version.
