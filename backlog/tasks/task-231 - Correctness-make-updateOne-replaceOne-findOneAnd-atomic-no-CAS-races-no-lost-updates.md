---
id: TASK-231
title: >-
  Correctness: make updateOne/replaceOne/findOneAnd* atomic (no CAS races, no
  lost updates)
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
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
- [ ] #1 Regression case A3 passes: of two concurrent conditional updateOne calls exactly one returns a document; concurrent updates to different fields both persist
- [ ] #2 The same concurrency tests pass for replaceOne and findOneAndUpdate; upsert under concurrency creates exactly one document
- [ ] #3 Stored JSON bodies no longer contain createdAt/updatedAt/_id (test reads raw body)
- [ ] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
