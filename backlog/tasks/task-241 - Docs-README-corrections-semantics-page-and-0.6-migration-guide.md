---
id: TASK-241
title: 'Docs: README corrections, semantics page and 0.6 migration guide'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - build-release
milestone: m-1
dependencies:
  - TASK-228
  - TASK-229
  - TASK-230
  - TASK-231
  - TASK-232
  - TASK-233
  - TASK-234
  - TASK-235
  - TASK-236
  - TASK-237
  - TASK-238
  - TASK-239
  - TASK-240
documentation:
  - stratadb-audit.md
priority: medium
type: docs
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
README and docs claim behavior that is fixed or changed in 0.6.0 (retries, compound indexes, timestamps, $like/$ilike, caseSensitive, transactions). Consumers need a migration guide for the breaking changes. Audit refs: C7, SDB-22.

## Implementation
1. Update the README sections: Automatic Retries, Collection Events (delivery guarantees), Type Safety, operators.
2. Add docs/guide pages: "Semantics vs MongoDB" (if not already added) and "Migrating to 0.6".
3. CHANGELOG `[Unreleased]`: consolidate a "Breaking changes" section covering strict operators, null/$ne semantics, LIKE case, async-only errors, transaction serialization, event timing and the Bun floor.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 README no longer describes any behavior contradicted by tests (retries, compound indexes, timestamps, LIKE, events)
- [ ] #2 docs/guide contains a Migrating to 0.6 page listing every breaking change with before/after code
- [ ] #3 bun run docs:build succeeds
<!-- AC:END -->
