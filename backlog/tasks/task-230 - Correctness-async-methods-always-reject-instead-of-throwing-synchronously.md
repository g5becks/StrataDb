---
id: TASK-230
title: 'Correctness: async methods always reject instead of throwing synchronously'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
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
- [ ] #1 A contract test covers every public async method of Strata and Collection and proves none throws synchronously (retries on and off)
- [ ] #2 Regression case A5 passes
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change (Breaking changes section)
<!-- AC:END -->
