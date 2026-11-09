---
id: TASK-232
title: 'Correctness: nest-safe transactions, serialized execute() and buffered events'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
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
- [ ] #1 Every write method works inside db.execute(), and nested execute() calls commit/roll back independently via savepoints (tests)
- [ ] #2 Regression case A4 passes: an outside write during a pending execute() survives that execute()'s rollback
- [ ] #3 No collection events are emitted for writes that are rolled back; events for committed writes are emitted after commit (tests)
- [ ] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change (Breaking changes section)
<!-- AC:END -->
