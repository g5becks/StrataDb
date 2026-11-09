---
id: TASK-258
title: 'Refactor: split sqlite-collection.ts and remove type/lint suppressions'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - api
milestone: m-2
dependencies:
  - TASK-243
  - TASK-244
  - TASK-245
  - TASK-246
  - TASK-249
  - TASK-250
  - TASK-252
  - TASK-253
documentation:
  - stratadb-audit.md
priority: low
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
src/sqlite-collection.ts is 2,204 lines with ts-expect-error and biome-ignore suppressions. Do this after the behavior work to avoid merge conflicts. Audit refs: C3, C4, D7.

## Implementation
1. Split into ddl.ts, read-ops.ts, write-ops.ts, events.ts and sql-builders.ts.
2. Replace the 5 `@ts-expect-error` around EventEmitter typing with a typed facade.
3. Refactor insertMany to remove the cognitive-complexity suppression.
4. Make no behavior change: test suite and benchmarks are identical before and after.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No source file in src/ exceeds ~600 lines
- [ ] #2 No @ts-expect-error remains for EventEmitter typing and no biome-ignore complexity suppression remains in collection code
- [ ] #3 Test results and benchmark numbers are unchanged within noise (recorded in notes)
- [ ] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
<!-- AC:END -->
