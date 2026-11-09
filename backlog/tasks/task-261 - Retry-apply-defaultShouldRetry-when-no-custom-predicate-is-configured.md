---
id: TASK-261
title: 'Retry: apply defaultShouldRetry when no custom predicate is configured'
status: To Do
assignee: []
created_date: '2026-11-09T13:23:00Z'
labels:
  - api
milestone: m-1
dependencies:
  - TASK-223
priority: medium
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
During TASK-223, source inspection confirmed withRetry forwards shouldRetry only when explicitly configured; otherwise p-retry retries all errors. The errno classifier fix is effective when selected, but the default policy still retries validation and unknown errors. Wire the classifier as the default in the documented v0.6 behavior-change window, preserving custom predicates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Default retries stop after the first validation, constraint or unknown error
- [ ] #2 Default retries recover from a real SQLITE_BUSY error after lock release without supplying shouldRetry
- [ ] #3 Custom shouldRetry overrides remain effective and the behavior change is documented
<!-- AC:END -->
