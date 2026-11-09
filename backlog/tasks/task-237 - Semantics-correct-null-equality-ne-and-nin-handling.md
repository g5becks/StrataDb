---
id: TASK-237
title: 'Semantics: correct null equality, $ne and $nin handling'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - api
milestone: m-1
dependencies:
  - TASK-229
documentation:
  - stratadb-audit.md
priority: high
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
`{ field: null }` emits `field = NULL`, which never matches. `$ne: null` never matches. `$ne: v` excludes documents where the field is null or missing (SQL three-valued logic). Audit ref: A11.

## Implementation
1. `null` equality → `IS NULL`; decide and document whether it matches missing fields (MongoDB: yes; recommended: yes, `jsonb_type(...) IS NULL`).
2. `$ne: null` → `IS NOT NULL`.
3. `$ne: v` → `(field IS NULL OR field <> ?)`; `$nin` gets the same treatment.
4. Add a "Semantics vs MongoDB" section to docs/guide covering these rules.
5. Flip regression case A11. Enable the skipped test at test/integration/complex-queries.test.ts:793.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Regression case A11 passes and the previously skipped null/undefined integration test is enabled and passes
- [ ] #2 Documented semantics for null, missing fields, $ne and $nin exist in docs/guide and match tests
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change (Breaking changes section)
<!-- AC:END -->
