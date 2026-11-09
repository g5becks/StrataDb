---
id: TASK-251
title: 'Testing: property-based differential tests for the query translator'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - testing
milestone: m-2
dependencies:
  - TASK-242
  - TASK-245
documentation:
  - stratadb-audit.md
priority: medium
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
The translator is ideal for differential testing against a naive in-memory evaluator; it would catch A2/A11/A13-class bugs automatically. Audit ref: Q4.

## Implementation
1. Add fast-check.
2. Generate random documents and random filters (all supported operators, logical combinations, nested paths) over a small schema.
3. Compare StrataDB results with an in-memory reference implementation of the documented semantics (null, $ne, LIKE escaping, case rules).
4. Use a fixed seed in CI and a random seed in a nightly workflow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A fast-check suite compares StrataDB find() against an in-memory evaluator for >= 500 generated cases per CI run (fixed seed)
- [ ] #2 A nightly workflow runs the suite with a random seed and reports the seed on failure
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
<!-- AC:END -->
