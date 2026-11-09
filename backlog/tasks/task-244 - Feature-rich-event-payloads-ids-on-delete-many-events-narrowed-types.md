---
id: TASK-244
title: 'Feature: rich event payloads (ids on delete/many events, narrowed types)'
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
- [ ] #1 Regression case A17 passes: DeleteEvent includes _id; deleteMany and updateMany events include ids
- [ ] #2 Type tests prove UpdateEvent.document is non-null for successful non-upsert updates
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
