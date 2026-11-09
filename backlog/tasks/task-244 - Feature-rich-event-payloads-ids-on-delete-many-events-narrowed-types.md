---
id: TASK-244
title: 'Feature: rich event payloads (ids on delete/many events, narrowed types)'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T20:52:00Z'
labels:
  - api
milestone: m-2
dependencies:
  - TASK-242
documentation:
  - stratadb-audit.md
priority: medium
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
DeleteEvent has only `{ filter, deleted }`, with no `_id`. deleteMany/updateMany emit no per-document ids. UpdateEvent.document is `T | null` even after success. agentx's SSE route works around this and loses ids. Audit ref: A17.

## Implementation
1. Use `RETURNING _id` (optionally `json(body)`) on delete and update statements.
2. DeleteEvent: add `_id` (and optional `document` via an option); deleteMany/updateMany events: add `ids: string[]`.
3. Narrow `UpdateEvent.document` to `T` for successful non-upsert updates (discriminated union).
4. Update the type tests. Flip regression case A17.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Regression case A17 passes: DeleteEvent includes _id; deleteMany and updateMany events include ids
- [x] #2 Type tests prove UpdateEvent.document is non-null for successful non-upsert updates
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add exact rich-payload regressions and compile-time successful-update/delete narrowing assertions before changes.
2. Use atomic DELETE RETURNING for resolved IDs and optional deleted documents; collect actual RETURNING IDs for batch writes and narrow successful update payloads.
3. Preserve commit buffering/listener isolation, document payload semantics and compatibility changes, run all host gates and local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- deleteOne uses one atomic DELETE with a limited ID subquery and RETURNING, reporting the actual _id, or null on a miss for either filter form. includeDocument:true adds a hydrated deleted snapshot and honors timestamps(false). DeleteEvent is a deleted-discriminated union; UpdateEvent is a successful/upsert union with non-null document (no update event is emitted on a miss).
- Batch writes collect IDs from actual RETURNING rows; empty batches report []. Trigger-ignored updates are excluded from IDs and modifiedCount, while matchedCount retains the selected row count. IDs have no ordering guarantee. Existing event buffering and listener isolation remain in effect.
- Regression-first: all four new rich-payload runtime cases failed before implementation; all now pass, including rollback suppression and delayed commit delivery. Both A17 audit regressions are now ordinary tests. Added expect-type assertions for successful non-upsert document and success/miss delete ID narrowing.
- Breaking change: event fixtures must include the new required ID fields; successful update documents can no longer be constructed as null. Object-filter delete misses now emit a consistent miss event. CHANGELOG and event guide document the migration and optional snapshots.
- Host gate PASS: 901 pass, 2 existing skips, 0 fail; TS 7.0.2 typecheck; lint; build; type tests; consumer TS 6/7 CRUD; source TS 5.9.3/6.0.3. Local CI pending committed SHA.
<!-- SECTION:NOTES:END -->
