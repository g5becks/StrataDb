---
id: TASK-267
title: 'Benchmarks: repair CRUD harness lifecycle and awaited setup'
status: To Do
assignee: []
created_date: '2026-11-10T02:13:00Z'
labels:
  - performance
milestone: m-2
dependencies:
  - TASK-230
documentation:
  - stratadb-audit.md
priority: medium
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Source review during P1/TASK-252 found CRUD benchmark groups that close their shared database during registration, before mitata runs callbacks, and seed/delete setup that reads fields from an unawaited insertOne promise. Repair the harness before the benchmark-tracking workflow, retaining all cases and separating setup/cleanup from timed operations appropriately.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All existing CRUD benchmark cases are retained and complete against live databases without closed-database or unhandled-promise failures
- [ ] #2 Shared setup and insert results are awaited where needed, and shared databases are closed only after benchmark execution
- [ ] #3 The runner fails on benchmark errors; bench:all, the host quality gate and required local CI checks pass, with local results recorded
<!-- AC:END -->
