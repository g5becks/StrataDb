---
id: TASK-258
title: 'Refactor: split sqlite-collection.ts and remove type/lint suppressions'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-10T03:04:00Z'
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
- [x] #1 No source file in src/ exceeds ~600 lines
- [x] #2 No @ts-expect-error remains for EventEmitter typing and no biome-ignore complexity suppression remains in collection code
- [x] #3 Test results and benchmark numbers are unchanged within noise (recorded in notes)
- [ ] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Capture the existing stable read/projection benchmarks and full test baseline.
2. Split collection implementation into shared core, DDL, read and write modules; preserve method bodies and constructor behavior, centralize typed event registration, and remove complexity suppressions through helper extraction. Split oversized translator and public type modules at existing boundaries.
3. Review API/type compatibility and source sizes, rerun identical benchmarks and full host gates/local CI, recording any variance.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Outcome: collection state/atomic helpers, DDL, read operations, single writes, batch/admin operations and typed listener registration are separated. Query translation splits into shape cache, operators and options. Public contracts split into read/write/batch/events/admin and projection/cursor type modules, preserving existing import paths and documentation.
- Breaking change: none. A TypeScript AST comparison verified all35 public collection members/overloads are identical. Existing method bodies and SQL order remain; named helper extraction replaces query/batch/cache complexity suppressions. Typed registration facade centralizes Node conditional listener overload handling without ts-expect-error.
- Verification: 1052 tests PASS, same6460 assertions/no failures/skips; full host gate, TS5.9.3/6.0.3/7.0.2, lint, build, type tests and packed consumer TS6/7+CRUD PASS. Every src file under600 lines (largest577); no collection complexity suppression or EventEmitter ts-expect-error remains.
- Benchmarks: identical fixtures/protocols, Bun1.4.4/SQLite3.54.0/macOS arm64, 5000 warmup and five x50000 reads. Before/after median us: statements translator off1.4067425->1.41790168 (+0.8%); on1.11580582->1.14488416 (+2.6%); two-field projection8.57713916->8.53364668 (-0.5%). Trial ranges overlap; no material performance change. Raw files at /Users/takinprofit/Dev/StrataDb-release/benchmarks/TASK-258/{before,attempt1}-{statements,projection}.json. Before source56fbff2 dirty only for task metadata; clean committed confirmation pending.
- Decisions: use a short internal inheritance chain to retain direct method dispatch and shared state without wrappers on hot operations. Rich public method docs remain on contract types; duplicate implementation examples were removed. Existing broken CRUD harness is tracked separately in TASK-267.
- Follow-ups: none.
<!-- SECTION:NOTES:END -->
