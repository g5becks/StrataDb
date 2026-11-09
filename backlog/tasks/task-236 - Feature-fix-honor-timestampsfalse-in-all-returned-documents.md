---
id: TASK-236
title: 'Feature fix: honor timestamps(false) in all returned documents'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T18:34:00Z'
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
- [x] #1 Regression case A9 passes
- [x] #2 Documents from a timestamps(false) schema have no createdAt/updatedAt keys across insert, update, replace, find, findOne and event payloads (tests)
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add timestamp-disabled tests across reads, projections, writes, upserts, before/after returns and event payloads.
2. Centralize public-document metadata visibility while retaining internal timestamp columns and correct mutation metadata.
3. Convert A9, document the behavior and run all host gates plus local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Centralized public-document visibility: timestamps(false) strips timestamp keys on insert/bulk results, hydrated reads, all atomic before/after/upsert returns, projections and event documents. Internal reads preserve metadata for validation and mutation; timestamp columns stay populated and original createdAt is retained.
- A9 now runs as a normal passing test. Regression-first suite failed for timestamp-disabled documents before the fix; all three cases now pass. It checks every return/event path and confirms true/default behavior and internal columns.
- Breaking change: none; honors the explicit opt-out while preserving defaults. CHANGELOG updated. Host gate PASS: typecheck TS 7.0.2, lint 99 files, 866 pass/3 existing skips/0 fail, build, type tests, consumer TS 6/7 and CRUD, source TS 5.9.3/6.0.3. Local CI pending committed SHA. Follow-ups: none.
<!-- SECTION:NOTES:END -->
