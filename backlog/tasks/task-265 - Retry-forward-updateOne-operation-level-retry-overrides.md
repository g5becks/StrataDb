---
id: TASK-265
title: 'Retry: forward updateOne operation-level retry overrides'
status: To Do
assignee: []
created_date: '2026-11-10T01:16:00Z'
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
- [ ] #1 retry:false on updateOne suppresses an enabled database/collection retry policy (real regression)
- [ ] #2 An explicit updateOne retry policy and custom predicate override inherited defaults, with promise-only failures preserved
- [ ] #3 Full host quality gate and local CI pass; retry documentation reflects the verified override behavior
<!-- AC:END -->
