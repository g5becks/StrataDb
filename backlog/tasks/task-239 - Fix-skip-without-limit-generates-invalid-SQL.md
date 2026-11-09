---
id: TASK-239
title: 'Fix: skip without limit generates invalid SQL'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T20:06:00Z'
labels:
  - api
milestone: m-1
dependencies:
  - TASK-228
documentation:
  - stratadb-audit.md
priority: medium
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
`find({}, { skip: 1 })` throws `near "OFFSET": syntax error`, because SQLite requires LIMIT before OFFSET. Audit ref: A14.

## Implementation
Emit `LIMIT -1 OFFSET ?` when only skip is given (through the FieldResolver's bound-parameter path). Flip regression case A14.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Regression case A14 passes: find({}, { skip: 1 }) returns n-1 documents
- [ ] #2 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #3 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add real skip-only pagination boundaries and mixed bound sort/filter/limit checks before implementation.
2. Emit LIMIT -1 when skip is specified without limit, convert A14 and update exact SQL expectation.
3. Document the fix and run all host gates plus local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Skip-only options now emit LIMIT -1 OFFSET with a validated bound offset through the single translateOptions path. Explicit limit zero remains zero, and sort/filter bindings keep their order. A14 now passes as a normal test.
- Regression-first case reproduced the OFFSET syntax error, then passed for zero/one/past-end offsets, descending filtered pagination, zero limit and bounded pages. Exact translator SQL assertion updated.
- Breaking change: none; valid skip-only requests now work. CHANGELOG updated. Host gate PASS: typecheck TS 7.0.2; lint 103 files; 874 pass/2 existing skips/0 fail; build; type tests; consumer TS 6/7 and CRUD; source TS 5.9.3/6.0.3. Local CI pending committed SHA.
- Regression milestone check: only six expected failures remain, owned by v0.7 tasks: A10 TASK-243; A12 TASK-245 (2); A15 TASK-246; A17 TASK-244 (2). No follow-up required.
<!-- SECTION:NOTES:END -->
