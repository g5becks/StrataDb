---
id: TASK-231
title: >-
  Correctness: make updateOne/replaceOne/findOneAnd* atomic (no CAS races, no
  lost updates)
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T18:11:00Z'
labels:
  - api
milestone: m-1
dependencies:
  - TASK-228
  - TASK-230
references:
  - src/sqlite-collection.ts
documentation:
  - stratadb-audit.md
priority: high
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
**Race condition (Critical).** `updateOne` runs `await findOne()`, merges in JS, then `UPDATE ... WHERE _id = ?`, and other async callers interleave in between. Repro: two concurrent conditional updateOne calls (CAS pending to running) both succeed, and concurrent updates of different fields lose one. agentx's trade-jobs `transition()` relies on this as a compare-and-swap. replaceOne and findOneAnd* share the pattern. updateOne also writes `updatedAt` into the JSON body. Audit refs: A3, P4, A9.

## Implementation
1. Make each single-document write either one SQL statement or a synchronous `db.transaction()` with no await between read and write:
   - preferred: `UPDATE t SET body = jsonb(?), updatedAt = ? WHERE _id = (SELECT _id FROM t WHERE <filter> LIMIT 1) AND <filter> RETURNING _id, json(body)`, with the merge computed inside a synchronous transaction that re-reads the row;
   - or `jsonb_patch`, but only if its RFC 7396 semantics (null deletes keys) are accepted and documented.
2. Apply to updateOne, replaceOne, findOneAndUpdate, findOneAndReplace, findOneAndDelete; upsert must be atomic too (INSERT ... ON CONFLICT or a sync transaction).
3. Stop writing `_id`/`createdAt`/`updatedAt` into the JSON body.
4. Flip regression case A3 (both variants).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Regression case A3 passes: of two concurrent conditional updateOne calls exactly one returns a document; concurrent updates to different fields both persist
- [x] #2 The same concurrency tests pass for replaceOne and findOneAndUpdate; upsert under concurrency creates exactly one document
- [x] #3 Stored JSON bodies no longer contain createdAt/updatedAt/_id (test reads raw body)
- [x] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add real Promise.all races for each single-document mutation/upsert and raw-body metadata assertions before the fix.
2. Perform selection, deep merge/replace/insert/delete and validation synchronously inside SQLite immediate transactions, with no await in the critical section.
3. Hydrate metadata from columns and keep it out of JSON bodies on every write; preserve existing merge and event behavior.
4. Convert A3, document decisions, run all quality gates and local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Selection, validation and mutations now execute synchronously in SQLite immediate transactions, including upserts and findOneAnd* operations. No await occurs in the critical section. Both A3 cases are normal passing tests.
- Retained JS deep merge semantics: arrays replace, explicit null remains a value, undefined fields serialize away. Chose synchronous transactions instead of RFC 7396 jsonb_patch to avoid changing document merge semantics. Events retain their existing names and emit after the mutation transaction; outer execute buffering belongs to TASK-232.
- Metadata lives in columns only on every insert/update/replace path and is hydrated for reads, preserving createdAt. Raw-body checks run after every write path.
- Regression-first evidence: new Promise.all suite initially had 10 failures/1 pass; now 11/11 pass. Covers conditional races on all five methods, independent-field updates on both merge methods, and 12-way upserts on three methods.
- Breaking change: none; fixes documented atomicity and storage duplication. Host gate PASS: typecheck TS 7.0.2; lint 91 files; 832 pass/3 existing skips/0 fail; build; type tests; consumer TS 6/7 and CRUD; source TS 5.9.3/6.0.3. Local CI pending committed SHA.

Verified with scripts/ci-local.sh (f3916e679874d32633b81699548b458ca881abe1, PASS); GitHub Actions unavailable (billing lock). macOS/Linux pinned/latest Bun 1.4.4 PASS; TS 5.9.3/6.0.3/7.0.2 source and type tests PASS; TS 7.1.0-beta advisory PASS. Logs: /Users/takinprofit/Dev/StrataDb-release/ci-local/f3916e6/logs. Self-review complete; no follow-up required.
<!-- SECTION:NOTES:END -->
