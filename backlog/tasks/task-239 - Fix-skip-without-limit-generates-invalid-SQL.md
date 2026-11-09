---
id: TASK-239
title: 'Fix: skip without limit generates invalid SQL'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
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
- [ ] #1 Regression case A14 passes: find({}, { skip: 1 }) returns n-1 documents
- [ ] #2 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #3 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
