---
id: TASK-230
title: 'Correctness: async methods always reject instead of throwing synchronously'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T18:04:00Z'
labels:
  - api
milestone: m-1
dependencies:
  - TASK-227
references:
  - src/retry-utils.ts
  - src/sqlite-collection.ts
documentation:
  - stratadb-audit.md
priority: high
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
With retries off (the default), `withRetry` returns `operation()` directly. Synchronous throws (SQL errors, validation, listener errors) escape from Promise-returning methods, so `c.find(x).catch(...)` crashes the process. With retries on, the same error becomes a rejection, so dev and prod behave differently. Audit ref: A5.

## Implementation
1. Make every public async method `async`, or wrap the operation with `Promise.try`.
2. Make `withRetry` always return a promise that rejects (never throws synchronously).
3. Add a contract test that iterates over every public async method of Collection and Strata (insertOne, insertMany, find, findOne, findById, count, search, updateOne, updateMany, replaceOne, deleteOne, deleteMany, findOneAnd*, drop, execute, ...) with bad input and asserts that a promise is returned and rejects, with retries both on and off.
4. Flip regression case A5.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A contract test covers every public async method of Strata and Collection and proves none throws synchronously (retries on and off)
- [x] #2 Regression case A5 passes
- [x] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change (Breaking changes section)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a promise-only contract suite over all Promise-returning collection methods and Strata.execute, with retries on and off; inspect initial failures.
2. Make withRetry capture synchronous operation errors in its returned promise; preserve retry behavior and synchronous APIs.
3. Convert A5, document the rejection contract, run all host gates and local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- withRetry is async and awaits callbacks on both paths, capturing synchronous errors without altering synchronous APIs. A5 is now a passing normal test.
- Contract suite exercises all 20 Promise-returning Collection/Strata methods with retries=0 and retries=1, using dropped-table, validation, closed-database and callback errors. Before the fix, no-retry collection calls and withRetry callbacks threw synchronously; after the fix every call returns a rejecting promise.
- Breaking change: Promise APIs always reject; consumers must await or attach catch.
- Host gate PASS: typecheck TS 7.0.2, lint 90 files, 821 pass/3 existing skips/0 fail, build, type tests, consumer TS 6/7 and CRUD, source TS 5.9.3/6.0.3. Local CI pending committed SHA.

Verified with scripts/ci-local.sh (4dcbbc3a5c6a9aa95b2f0171a69065834f0f39ab, PASS); GitHub Actions unavailable (billing lock). macOS/Linux pinned/latest Bun 1.4.4 PASS; TS 5.9.3/6.0.3/7.0.2 source and type tests PASS; TS 7.1.0-beta advisory PASS. Follow-up TASK-263 records the independently reproduced pre-existing exists-cache issue and cache fixture correction.
<!-- SECTION:NOTES:END -->
