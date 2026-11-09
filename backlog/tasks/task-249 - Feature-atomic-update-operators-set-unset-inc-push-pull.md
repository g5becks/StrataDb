---
id: TASK-249
title: 'Feature: atomic update operators ($set, $unset, $inc, $push, $pull)'
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
updateOne only merges, so atomic counters and array appends need read-modify-write. Audit ref: A22.

## Implementation
1. Support `$set`, `$unset`, `$inc`, `$push`, `$pull` in update documents (mutually exclusive with plain merge objects), translated to `jsonb_set`/`jsonb_remove`/`jsonb_insert` expressions in a single UPDATE statement.
2. Validate paths through the FieldResolver.
3. Concurrency test: 100 concurrent `$inc: { n: 1 }` → n === 100.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each operator is translated to a single UPDATE statement (test asserts SQL shape or statement count)
- [ ] #2 100 concurrent $inc updates produce exactly +100
- [ ] #3 Mixing operators with plain fields in one update rejects with QueryError
- [ ] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
