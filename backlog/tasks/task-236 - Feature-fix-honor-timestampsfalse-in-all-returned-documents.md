---
id: TASK-236
title: 'Feature fix: honor timestamps(false) in all returned documents'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - api
milestone: m-1
dependencies:
  - TASK-231
documentation:
  - stratadb-audit.md
priority: medium
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
`timestamps(false)` is ignored: documents still get createdAt/updatedAt. agentx relies on it in two schemas. Audit ref: A9.

## Implementation
1. Honor `schema.timestamps === false`: returned documents omit createdAt/updatedAt. The table columns may remain (they are NOT NULL), so fill them internally.
2. Cover insert, update, replace, find, projection and events.
3. Flip regression case A9.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Regression case A9 passes
- [ ] #2 Documents from a timestamps(false) schema have no createdAt/updatedAt keys across insert, update, replace, find, findOne and event payloads (tests)
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
