---
id: TASK-248
title: 'DX: detect schema mismatch on cached collections; unify creation paths'
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
`db.collection(name, schema)` returns the cached instance even when a different schema is passed. The builder and createSchema paths plumb options differently (the builder skips retry defaults). Audit ref: A21.

## Implementation
1. Compare the schema (structural hash) on cached lookups and throw SchemaValidationError on mismatch.
2. Route both creation paths through one factory so enableCache and retry defaults apply identically. Add tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Calling db.collection(name, otherSchema) after db.collection(name, schema) throws SchemaValidationError (test)
- [ ] #2 Builder-created and schema-created collections receive identical cache and retry defaults (test)
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
