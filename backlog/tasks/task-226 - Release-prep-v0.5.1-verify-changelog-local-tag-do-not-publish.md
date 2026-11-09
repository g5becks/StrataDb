---
id: TASK-226
title: 'Release prep: v0.5.1 (verify, changelog, local tag; do not publish)'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T13:30:00Z'
labels:
  - build-release
milestone: m-0
dependencies:
  - TASK-214
  - TASK-215
  - TASK-216
  - TASK-217
  - TASK-218
  - TASK-219
  - TASK-220
  - TASK-221
  - TASK-222
  - TASK-223
  - TASK-224
  - TASK-225
documentation:
  - stratadb-audit.md
priority: medium
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CHANGELOG.md has a [0.5.1] section covering every task in this milestone
- [x] #2 package.json version is 0.5.1 and all verification commands pass
- [ ] #3 Local tags v0.5.0 (retroactive) and v0.5.1 exist; nothing is pushed or published
- [x] #4 Task notes contain the exact publish commands for the maintainer
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Finalize the 0.5.1 changelog, bump package version, refresh lockfiles, and regenerate API docs.
2. Run frozen installs, coverage suite on current/floor Bun, blocking TypeScript source/type-test matrix, lint, build, docs, consumer smoke, workflow validation and pack review.
3. Record exact maintainer publish commands and create local annotated v0.5.0/v0.5.1 tags; commit release prep while leaving this task In Progress, then stop.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Prepared stratadb@0.5.1 and the dated CHANGELOG section covering TASK-214 through TASK-226; regenerated API documentation. The Bun floor remains >=1.3.14; .mjs/.d.mts exports are unchanged.
- Verification: both frozen installs, typecheck, lint (84 files), bun test --coverage (733 pass, 0 fail, 3 existing skips; 97.33% lines / 97.98% functions), build, type tests, docs build, actionlint and pack --dry-run (35 files) pass. TS 5.9.3/6.0.3/7.0.2 source and type-test checks all pass; advisory 7.1.0-beta checks also pass. Full tests and packed-consumer smoke pass on Bun 1.3.14 and 1.4.4. Consumer TS 6/7 checks use skipLibCheck:false and assert CRUD against stratadb@0.5.1.
- Decisions: retroactive v0.5.0 targets c105ba5c0100b2e7bf6e59cdf1ae64d3b7a1fada: the 2026-01-09 version/changelog bump is cd451fe, and the published 0.5.0 tarball README matches c105ba5 (not cd451fe). Registry metadata has no gitHead. This identifies the published content revision from local history.
- No blocked m-0 tasks. Follow-up TASK-261 in m-1 covers wiring defaultShouldRetry as the default policy. Native SQLiteError errno fault-injection detail is recorded in TASK-223; real busy recovery is tested on both supported runtimes.
- Remote CI run pending maintainer push. Existing TypeDoc comment/link warnings and VitePress chunk advice do not fail the docs build. Self-reviewed release/package changes and git diff --check.
- Local annotated tags are the only release actions authorized here. v0.5.1 will identify the release-preparation commit; a following documentation-only commit will record tag verification. Leave TASK-226 In Progress at the maintainer publishing gate.

Maintainer commands (NOT executed by this agent):
```sh
git switch release/v0.5.1
git push origin release/v0.5.1
git push origin refs/tags/v0.5.0 refs/tags/v0.5.1
```

Run packaging/publishing from the v0.5.1 tag in the maintainer's provenance-capable CI environment with OIDC id-token permission and registry authorization:
```sh
git switch --detach v0.5.1
bun install --frozen-lockfile
bun run build
bun pm pack --filename stratadb-0.5.1.tgz
npm publish ./stratadb-0.5.1.tgz --provenance --access public
```

The npm invocation is a maintainer-only provenance publication command documented as requested; all engineering/install/test/build commands in this session used Bun. No push, publication or GitHub release creation was performed.
<!-- SECTION:NOTES:END -->
