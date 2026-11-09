---
id: TASK-246
title: 'Correctness: cursor pagination across all sort keys, NULLs and unknown cursors'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - api
milestone: m-2
dependencies:
  - TASK-242
documentation:
  - stratadb-audit.md
priority: medium
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
An unknown cursor id silently returns the first page. Only the first sort key is used. NULL sort values are skipped. There is no `_id` tie-breaker in ORDER BY. Audit ref: A15.

## Implementation
1. Unknown cursor → QueryError (or an explicit `invalidCursor` result; decide and document).
2. Build a lexicographic tuple comparison across all sort keys plus `_id`; always append `_id` to ORDER BY when a cursor is used.
3. Define NULL ordering (NULLS FIRST for asc, or configurable) and include it in the comparison.
4. Property test: random data with duplicates and NULLs, random multi-key sorts; walking pages yields every row exactly once.
5. Flip regression case A15.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Regression case A15 passes (unknown cursor is an error)
- [ ] #2 A property test over random datasets and multi-key sorts proves pagination returns every row exactly once
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
