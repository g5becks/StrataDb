---
id: TASK-265
title: 'Retry: forward updateOne operation-level retry overrides'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-10T01:16:00Z'
updated_date: '2026-11-10T13:26:00Z'
labels:
  - api
milestone: m-2
dependencies:
  - TASK-248
priority: medium
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A real in-memory repro during TASK-249 used a database retry policy with retries:1 and shouldRetry:true, then updateOne(id, invalidData, {retry:false}). Schema validation ran twice instead of once. The public Collection interface accepts retry, but SQLiteCollection.updateOne omits it and calls buildRetryOptions(undefined, signal). replaceOne correctly attempted once in the same repro. Forward the updateOne override without changing other mutation semantics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 retry:false on updateOne suppresses an enabled database/collection retry policy (real regression)
- [x] #2 An explicit updateOne retry policy and custom predicate override inherited defaults, with promise-only failures preserved
- [ ] #3 Full host quality gate and local CI pass; retry documentation reflects the verified override behavior
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce retry:false and explicit-predicate override failures with real SQLite validation counters and unchanged-row/event assertions.
2. Forward updateOne retry options through the existing retry boundary without changing mutation semantics.
3. Document override precedence, run full host gates and local CI, and record evidence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Outcome: updateOne now forwards its declared operation retry override through the existing boundary; mutation SQL, transaction and event behavior are unchanged. Retry docs describe false suppression and explicit policy/predicate precedence.
- Breaking change: none; implementation now honors the existing public option.
- Regression-first: both database/collection retry:false cases attempted validation twice instead of once; explicit custom-policy case attempted once instead of three. All three now PASS against real SQLite, with promise-only rejections, unchanged rows and no update events on failure. Explicit custom predicates remain authoritative.
- Verification: full host gate PASS,1055 tests/no failures/skips, source TS5.9.3/6.0.3/7.0.2, lint, build, type assertions and packed consumer TS6/7+CRUD. Committed local CI pending.
- Decisions: forward only the missing option; reuse existing retry merging and failure classification.
- Follow-ups: none.
<!-- SECTION:NOTES:END -->
