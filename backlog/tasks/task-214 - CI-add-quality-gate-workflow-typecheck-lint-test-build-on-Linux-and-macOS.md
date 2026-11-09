---
id: TASK-214
title: >-
  CI: add quality-gate workflow (typecheck, lint, test, build) on Linux and
  macOS
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
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
- [ ] #1 .github/workflows/ci.yml runs typecheck, lint, bun test --coverage, build and type tests on ubuntu-latest and macos-latest for a pinned Bun version and the latest Bun
- [ ] #2 All third-party actions in .github/workflows/*.yml are pinned by commit SHA
- [ ] #3 deploy-docs.yml no longer uses bun-version: latest
- [ ] #4 lefthook pre-push runs bun test; package.json prepare script is only 'lefthook install'
- [ ] #5 The workflow runs green on a PR branch (the 2 known removeAllListeners failures are fixed in a separate task; until then they may be marked test.failing with a reference to that task)
<!-- AC:END -->
