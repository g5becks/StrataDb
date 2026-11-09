---
id: TASK-250
title: 'Feature: read-only database mode'
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
priority: low
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
agentx's reference DB relies on DDL being a no-op against a read-only file. Bun 1.4.4 rejects `{ readonly: true, create: true }`. Audit refs: A22, 1B-B1.

## Implementation
1. `new Strata({ database: path, readonly: true })` opens with `{ readonly: true }` only.
2. In read-only mode, skip all DDL and reject every write method with a typed error (e.g. ConnectionError "database is read-only").
3. Tests with a temp file DB.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 readonly: true opens an existing file without running DDL and all reads work (test)
- [ ] #2 Every write method rejects with a typed read-only error (test)
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
