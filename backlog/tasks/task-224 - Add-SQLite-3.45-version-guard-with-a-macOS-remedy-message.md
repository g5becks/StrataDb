---
id: TASK-224
title: Add SQLite >= 3.45 version guard with a macOS remedy message
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - api
milestone: m-0
dependencies:
  - TASK-215
references:
  - src/stratadb.ts
documentation:
  - stratadb-audit.md
priority: medium
type: enhancement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
StrataDB requires SQLite >= 3.45 (jsonb functions). On macOS, Bun loads the system libsqlite3, so the version depends on the OS. Older macOS releases fail with an obscure "no such function: jsonb_extract". Audit ref: 1B-B3.

## Implementation
1. In the `Strata` constructor, run `select sqlite_version()` once and compare it semver-wise against 3.45.0.
2. If it is too old, throw a `ConnectionError` (it exists in src/errors.ts) naming the found version, the required version, and `Database.setCustomSQLite()` as the macOS remedy.
3. Unit-test it by injecting a database whose version query returns an old version (wrap or stub `query`).
4. Document the requirement in README (Installation section).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 new Strata() throws ConnectionError mentioning the found version, 3.45.0 and Database.setCustomSQLite() when sqlite_version() < 3.45.0 (unit test with stubbed version)
- [ ] #2 No behavior change on SQLite >= 3.45 (existing tests pass)
- [ ] #3 README documents the SQLite >= 3.45 requirement and the macOS remedy
- [ ] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
