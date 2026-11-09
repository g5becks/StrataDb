---
id: TASK-245
title: 'Feature fix: $elemMatch on arrays of objects'
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
`$elemMatch` with field keys (arrays of objects) produces `WHERE ` with an empty condition, a SQL syntax error. Audit ref: A12.

## Implementation
Non-`$` keys inside `$elemMatch` become sub-paths `json_extract(json_each.value, ?)`, recursing through the normal field-condition translator; `$` operators apply to `json_each.value` as today. Flip regression case A12 and enable the skipped test at test/integration/complex-queries.test.ts:358.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Regression case A12 passes and the previously skipped $elemMatch integration test is enabled and passes
- [ ] #2 Nested operators inside $elemMatch (e.g. { qty: { $gte: 2 } }) work (tests)
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
