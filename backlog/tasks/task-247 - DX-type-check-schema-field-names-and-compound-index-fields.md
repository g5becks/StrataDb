---
id: TASK-247
title: 'DX: type-check schema field names and compound index fields'
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
priority: low
type: enhancement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
`field<K extends keyof T | string>()` accepts any string, so typos compile. The same applies to compoundIndex fields. Audit ref: A20.

## Implementation
Constrain names to `keyof T | DocumentPath<T>` (the Paths helper already exists), keep an explicit escape hatch (e.g. `fieldUnchecked()`), and add type tests for valid paths, invalid names and nested paths.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 createSchema<T>().field("typo") fails to compile while valid top-level and dotted paths compile (type tests)
- [ ] #2 An escape hatch for untyped fields exists and is documented
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
