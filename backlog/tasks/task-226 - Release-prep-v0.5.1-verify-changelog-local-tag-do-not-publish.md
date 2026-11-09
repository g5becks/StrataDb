---
id: TASK-226
title: 'Release prep: v0.5.1 (verify, changelog, local tag; do not publish)'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T14:44:00Z'
labels:
  - blocked
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
- [x] #3 Local tags v0.5.0 (retroactive) and v0.5.1 exist; nothing is pushed or published
- [x] #4 Task notes contain the exact publish commands for the maintainer
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reverify the unchanged v0.5.1 tag in the authorized scratch worktree with the full release quality gate.
2. Push release/v0.5.1, create the release PR, require passing CI, merge without squash, and fast-forward main.
3. Pack and publish stratadb@0.5.1 locally from the tag, push v0.5.0/v0.5.1, verify the registry and isolated consumer, and create the GitHub release.
4. Record release evidence, close TASK-226 on main, push bookkeeping, and clean local release worktrees/branches.
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

- Tag verification complete: annotated v0.5.0 -> c105ba5c0100b2e7bf6e59cdf1ae64d3b7a1fada; annotated v0.5.1 -> 73bf38c (release preparation). git cat-file reports tag for both references, and the v0.5.1 package manifest is version 0.5.1. No remote actions occurred. This final bookkeeping commit changes only task metadata; the release tag remains on the verified release content.
- Gate state: all four acceptance criteria verified; status deliberately remains In Progress pending maintainer publication. Stop here as instructed.

- STOPPED at mission Step 0 on 2026-11-09: npm whoami exited 1; expected identity takinprofit could not be verified. Error: npm error code EPERM; syscall open; path /Users/takinprofit/.npm/_cacache/tmp/***; errno EPERM. npm reported root-owned cache files and could not write /Users/takinprofit/.npm/_logs. No cache relocation, permission workaround, credential change or retry was attempted. Environment failure stops all release and milestone work per mission. TASK-226 remains In Progress with label blocked; previously checked criteria are historical verification, not fresh release verification.
- Other Step 0 checks: GIT_OK; CACHE_OK; gh auth status confirmed active account g5becks; git push --dry-run origin HEAD exited 0 (dry run only). The dry-run hook passed typecheck, lint (84 files) and tests (733 pass, 3 existing skips, 0 fail, 2117 assertions across 33 files, Bun 1.4.4). The environment checks were executed in one invocation, so the GitHub check and dry-run also completed after npm failed; no actual push occurred.
- Resume snapshot: branch release/v0.5.1 initially clean at 8db6003; origin/main c105ba5; local annotated tags v0.5.0 and v0.5.1 unchanged. gh pr list --state all returned []; remote tag list empty. No PR, CI run, npm publication or GitHub release was created. npm versions/latest were not queried after the npm preflight failure; registry state is unverified this session. Full tag verification, TS 5.9/6.0 checks, build, type tests, consumer smoke and actionlint were not rerun. No test.failing matches currently exist in test/; Appendix A suite TASK-227 has not started.
- Milestones at stop: m-0 v0.5.1 Guardrails 12/13 done; m-1 v0.6.0 Safety and Correctness 0/17 done; m-2 v0.7.0 DX and Performance 0/18 done. No tasks completed or follow-up tasks created this session. Release-workflow task creation is deferred to Phase B after v0.5.1 release.
- Exact next step: maintainer must restore normal access to the existing npm cache (and ensure the execution environment permits that access), then rerun all Step 0 checks; npm whoami must succeed as takinprofit. Once all pass, remove blocked label via Backlog CLI and resume R(0.5.1) step 1 at the unchanged v0.5.1 tag. Do not bypass npm preflight or use an alternative cache or credentials.

- Maintainer authorization (2026-11-09 mission): pushing, merging and publishing stratadb 0.5.1, 0.6.0 and 0.7.0 are explicitly authorized. This overrides earlier do-not-publish/local-tag-only wording in TASK-226, TASK-242 and TASK-260. Follow mission release procedure R, including local npm publish without --provenance before pushing tags, passing PR CI and merge without squash/rebase. Plan approval is pre-granted. All mission hard rules remain in force.

- Resumed mission: all Step 0 checks passed (GIT_OK, CACHE_OK, WT_DIR_OK; npm identity takinprofit; active GitHub account g5becks; git push --dry-run origin HEAD exit 0 with hooks). Removed historical blocked label. Initial branch clean at 97921dd, no PRs, npm latest 0.5.0, local tags unchanged. Maintainer pre-granted this release plan and publication authorization.

- R(0.5.1) step 1 passed at annotated tag v0.5.1 / 73bf38c in /Users/takinprofit/Dev/StrataDb-release/v0.5.1 on Bun 1.4.4: frozen install; typecheck (TS 7.0.2); lint (84 files); bun test (733 pass, 3 existing skips, 0 fail, 2117 assertions); build; test:types; packed consumer TS 6.0.3/7.0.2 with skipLibCheck:false and CRUD; source tsc 5.9.3 and 6.0.3. package version 0.5.1 and dated CHANGELOG section confirmed. Tag remains unchanged; subsequent commits are backlog-only.

- STOPPED at R(0.5.1) step 3 (required PR CI) on 2026-11-09. Release PR: https://github.com/g5becks/StrataDb/pull/1, head d8c8cf12b9ddbc5411e5887570c200e58c347c80. Push and PR CI runs both concluded failure: https://github.com/g5becks/StrataDb/actions/runs/42637495374 and https://github.com/g5becks/StrataDb/actions/runs/42637526452. Every job failed with no steps executed. GitHub check-run annotations for jobs 129229445871 and 129229446117 state: "The job was not started because your account is locked due to a billing issue." This requires account-owner action; changing code cannot fix it. No CI fix commits, bypass, merge, publication, remote tag push, or GitHub release was attempted. TASK-226 remains In Progress and is labeled blocked. No new task was completed or follow-up task created. Phases B/C were not started because later milestones depend on this release.
- Required log command was attempted for both runs: gh run view <id> --log-failed exited 1, reporting "failed to get run log: creating cache entry: open /Users/takinprofit/.cache/gh/run-log-<id>-<timestamp>.zip: operation not permitted". No cache relocation or permission workaround was attempted. Read-only gh api check-run annotations exposed the billing failure; gh run view --json confirmed all jobs have steps: [].
- Final local verification: R step 1 passed completely as recorded above; bunx --bun actionlint also exited 0. Existing tests: 733 passing, 3 existing skips, 0 failures; no test.failing in test/. Appendix A regression suite TASK-227 is not started. Milestones: m-0 12/13, m-1 0/17, m-2 0/18 done. Source and type tests TS 7.0.2 passed; source TS 5.9.3/6.0.3 and packed-consumer TS 6.0.3/7.0.2 passed. Version/changelog confirmed at unchanged local v0.5.1 tag 73bf38c. Scratch worktree remains at the verified tag for resumption; merged-branch cleanup is deferred.
- Exact next step: account owner must resolve the GitHub Actions billing lock. Then inspect actual state and rerun Step 0; push any local backlog bookkeeping commit on release/v0.5.1 if needed, rerun required CI for PR #1, and require every job to pass before R step 4. Keep v0.5.1 at 73bf38c while changes remain backlog-only. No merge commit, npm tarball URL, GitHub release URL or release-workflow run exists for 0.5.1 yet. Maintainer publish authorization persists.
<!-- SECTION:NOTES:END -->
