---
id: TASK-257
title: 'Performance: benchmark tracking workflow'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - performance
  - build-release
milestone: m-2
dependencies:
  - TASK-252
documentation:
  - stratadb-audit.md
priority: low
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
The mitata benchmarks exist but are not tracked over time, so regressions are invisible. Audit ref: Q7.

## Implementation
Add a workflow (workflow_dispatch + weekly schedule) that runs `bun run bench:all` and uploads results as an artifact. Optionally compare with the previous artifact and comment on large regressions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A workflow runs bench:all on demand and weekly and uploads results as an artifact
- [ ] #2 README or CONTRIBUTING explains how to read the benchmark artifact
<!-- AC:END -->
