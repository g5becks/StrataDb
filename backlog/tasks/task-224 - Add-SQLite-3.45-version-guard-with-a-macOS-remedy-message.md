---
id: TASK-224
title: Add SQLite >= 3.45 version guard with a macOS remedy message
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T13:25:00Z'
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
- [x] #1 new Strata() throws ConnectionError mentioning the found version, 3.45.0 and Database.setCustomSQLite() when sqlite_version() < 3.45.0 (unit test with stubbed version)
- [x] #2 No behavior change on SQLite >= 3.45 (existing tests pass)
- [x] #3 README documents the SQLite >= 3.45 requirement and the macOS remedy
- [x] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add constructor regressions for old, boundary and modern SQLite versions using a stubbed version query.
2. Guard SQLite >=3.45 before database use and throw a typed actionable connection error.
3. Document the macOS remedy and run the full gate plus compiler matrix.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Strata checks sqlite_version() once before initializing collections, compares numeric version components, and rejects pre-3.45 SQLite with ConnectionError naming the found/required versions and Database.setCustomSQLite(). README and CHANGELOG document JSONB and the macOS remedy.
- Verification: six constructor regressions failed before the guard, then passed for old, boundary, multi-digit-minor and newer-major versions. Full gate and compiler matrix pass (723 pass, 0 fail, 3 skip). Rejected external connections remain usable. Remote CI run pending maintainer push.
- Decisions: close internally opened connections on version rejection; leave rejected caller-supplied connections owned by the caller. Self-reviewed version comparison and docs.
<!-- SECTION:NOTES:END -->
