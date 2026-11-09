---
id: TASK-253
title: 'Performance: push inclusion projections into SQL'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - performance
milestone: m-2
dependencies:
  - TASK-252
documentation:
  - stratadb-audit.md
priority: low
type: enhancement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
find() selects and parses whole documents, then drops fields in JS. Audit ref: P3.

## Implementation
For inclusion projections, build `json_object('a', jsonb_extract(body, ?), ...)` (paths via the FieldResolver) and parse only that; keep the JS path for exclusion projections. Benchmark wide documents (50 fields) projecting 2 fields.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Inclusion projections are computed in SQL (test inspects generated SQL)
- [ ] #2 A wide-document benchmark shows a measurable improvement (numbers recorded in notes)
- [ ] #3 Projection behavior is unchanged (existing projection tests pass)
- [ ] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
