---
id: TASK-214
title: >-
  CI: add quality-gate workflow (typecheck, lint, test, build) on Linux and
  macOS
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T12:46:00Z'
labels:
  - build-release
milestone: m-0
dependencies: []
documentation:
  - stratadb-audit.md
priority: high
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 .github/workflows/ci.yml runs typecheck, lint, bun test --coverage, build and type tests on ubuntu-latest and macos-latest for a pinned Bun version and the latest Bun
- [x] #2 All third-party actions in .github/workflows/*.yml are pinned by commit SHA
- [x] #3 deploy-docs.yml no longer uses bun-version: latest
- [x] #4 lefthook pre-push runs bun test; package.json prepare script is only 'lefthook install'
- [ ] #5 The workflow runs green on a PR branch (the 2 known removeAllListeners failures are fixed in a separate task; until then they may be marked test.failing with a reference to that task)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add Linux/macOS CI with pinned/latest Bun and immutable action references; pin docs Bun.
2. Enable pre-push tests and reduce prepare to hook installation.
3. Validate workflows and run the local quality gate; record known TASK-215 failures without weakening tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Added the Linux/macOS quality-gate workflow with Bun 1.4.4/latest; pinned every workflow action to its upstream release commit and pinned the docs runtime. Enabled pre-push tests and reduced prepare to lefthook install.
- Verification: workflow YAML parsed and immutable action references checked; bunx --bun actionlint exited 0; typecheck, lint (76 files), build, and existing tsd type tests pass. bun test and bun test --coverage each report 710 pass, 2 fail, 3 skip; both failures are the pre-existing A18 cases assigned to TASK-215. No tests changed. Remote CI run pending maintainer push.
- Blocked by session filesystem permissions: git switch -c could not write refs (Git connector successfully created and checked out release/v0.5.1); bunx lefthook install cannot write .git/hooks/pre-push; frozen install with a writable temporary cache reaches prepare but cannot write .git/hooks/pre-commit. Default Bun cache writes are also denied. Shell network DNS resolution for github.com is unavailable.
- Cannot perform the required hook installation and hook-protected task commit in this session. Leaving TASK-214 In Progress with criterion 5 unchecked. All independent tasks also require commits, so stopping until repository Git metadata is writable. No dependencies or lockfile changed, no publish/push/tag operations performed, and no follow-up tasks created.
- Decisions: retain the known failures until TASK-215 rather than introduce test.failing outside TASK-227. The CI runtime matrix tests current Bun 1.4.4 and latest; the package runtime floor remains unchanged for this milestone.

- Final compiler matrix: bunx -p typescript@5.9.3 tsc --noEmit passes; 6.0.3 and 7.0.2 each reproduce the 56 pre-existing missing Bun/Node globals and cascading emitter errors from audit D2. TASK-216 already covers these errors; no additional follow-up task is needed.
- Stop state: release/v0.5.1 exists and is checked out. No commits were created because hook installation is blocked. The reviewable CI implementation and CLI-managed task metadata remain uncommitted; a clean working tree cannot be delivered while retaining this work under the current hook restriction.

- Resumed after maintainer repaired permissions and installed hooks. Committing the prepared CI changes with TASK-214 still In Progress; criterion 5 will be verified after TASK-215 under the authorized exception.

- Resume results (2026-11-09): committed the prepared CI implementation as f1095ad with installed Git hooks; TASK-214 remains In Progress and the blocked label was removed as requested. TASK-215 implementation committed as d44a0a8 and is now Done.
- Post-fix local verification: typecheck, lint, bun test --coverage (713 pass, 3 existing skips, 0 failures), build, and test:types pass.
- Criterion 5 remains unchecked: the required frozen installation fails under the still-active execution sandbox. Default command: cannot write files to cache directory /Users/takinprofit/.cache/.bun/install/cache/: EPERM. With BUN_INSTALL_CACHE_DIR=/tmp/stratadb-bun-cache, installation reaches prepare but lefthook install fails: could not replace the hook: remove .git/hooks/commit-msg: operation not permitted. Initial shell git add also failed creating .git/index.lock; Git connector commits work with the installed hooks.
- The supported Serena shell fallback still returns: MCP tool call requires approval, but approval policy is never. No hook bypass, install-script suppression, or permission escalation was used. No local-green claim is made for the complete CI sequence. Remote CI run pending maintainer push.
- Stopping before TASK-216 because the only authorized parallel In Progress exception was TASK-215; TASK-214 cannot be completed until frozen install succeeds. No new follow-up tasks, dependency changes, tags, pushes, or publishing.
<!-- SECTION:NOTES:END -->
