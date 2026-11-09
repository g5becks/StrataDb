---
id: TASK-263
title: 'Correctness: preserve $exists boolean semantics in cached query templates'
status: To Do
assignee: []
created_date: '2026-11-09T18:02:00Z'
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
During query safety review, a real translator with caching enabled produced IS NOT NULL for both {count: {$exists: true}} and a subsequent {count: {$exists: false}}: cache keys encode only boolean type, while SQL depends on the boolean value. Preserve correct boolean semantics across cache hits. Also explicitly enable caching in the new binding-order and malformed-cache regression fixtures (database caching defaults off), so those tests exercise their claimed paths.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Real SQLite cached and uncached $exists queries agree for present, null and missing fields, in both true/false call orders
- [ ] #2 SQL-dependent boolean values cannot reuse an incompatible cached template
- [ ] #3 Binding-order and malformed-value cache regression fixtures explicitly enable caching and pass the full quality gate
<!-- AC:END -->
