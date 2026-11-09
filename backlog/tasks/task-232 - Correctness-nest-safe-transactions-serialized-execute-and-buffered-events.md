---
id: TASK-232
title: 'Correctness: nest-safe transactions, serialized execute() and buffered events'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T18:16:00Z'
labels:
  - api
milestone: m-1
dependencies:
  - TASK-230
  - TASK-231
references:
  - src/stratadb.ts
  - src/sqlite-collection.ts
documentation:
  - stratadb-audit.md
priority: high
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
updateMany and deleteMany issue their own `BEGIN TRANSACTION`, so they fail inside `db.execute()` ("cannot start a transaction within a transaction"). `execute()` awaits user code inside BEGIN, so unrelated concurrent writes join the transaction and are rolled back with it. Events fire for writes that are later rolled back. Bun note: `db.transaction()` is synchronous-only. Audit refs: A4, P5, 1B-B1.

## Implementation
1. Add an internal transaction manager with depth tracking: the outermost level uses BEGIN/COMMIT/ROLLBACK, nested levels use `SAVEPOINT sp_n` / `RELEASE` / `ROLLBACK TO`.
2. updateMany, deleteMany, insertMany and drop use the manager (savepoint when nested).
3. `execute()` is serialized behind an async mutex. Writes issued outside an active execute() wait for it to finish rather than joining it. Document this.
4. Buffer events during a transaction; flush on the outermost commit, drop on rollback.
5. `transaction().collection(name, schema, options)` forwards options.
6. Flip regression case A4 (all variants).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every write method works inside db.execute(), and nested execute() calls commit/roll back independently via savepoints (tests)
- [x] #2 Regression case A4 passes: an outside write during a pending execute() survives that execute()'s rollback
- [x] #3 No collection events are emitted for writes that are rolled back; events for committed writes are emitted after commit (tests)
- [ ] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change (Breaking changes section)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add real transaction tests for all write methods, nested commit/rollback, sibling/outside concurrency and committed-only events.
2. Share a per-connection transaction manager with savepoint frames, async-context ownership and serialized queues; buffer events per frame.
3. Route execute/manual transactions and batch/drop operations through the manager; forward collection options.
4. Convert all A4 cases, document queueing semantics, and run full host gates and local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Shared per-connection manager now tracks transaction/savepoint frames, async-context ownership, root and nested queues, and buffered events. execute callbacks serialize; outside operations queue and survive unrelated rollback. Concurrent sibling execute calls get distinct savepoints. Manual handles nest and dispose idempotently.
- insertMany/updateMany/deleteMany/drop use synchronous managed frames; drop cleanup is deferred until commit, preserving listeners on rollback. Transaction collection access forwards options. Ordered/unordered bulk-insert result semantics remain intact.
- Breaking change: events are committed-only and outside operations wait; synchronous manual transaction or collection creation cannot join another pending execute and raises TransactionError. Create collections beforehand/inside the callback. Await every transaction operation.
- Regression-first evidence: 16 new cases originally failed; 17 now pass, covering all 11 write methods, nested independent commit/rollback, sibling execution, queue order, event commit state, manual disposal, options, and outside DDL safety. All four A4 variants are normal passing tests.
- Host full gate PASS: TS 7.0.2 typecheck, lint 93 files, 849 pass/3 existing skips/0 fail, build, type tests, consumer TS 6/7 and CRUD, source TS 5.9.3/6.0.3. Focused transaction/regression checks rerun after final synchronous-access guard review. Local CI pending committed SHA.
<!-- SECTION:NOTES:END -->
