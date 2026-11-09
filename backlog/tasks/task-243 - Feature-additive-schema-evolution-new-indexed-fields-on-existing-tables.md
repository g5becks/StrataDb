---
id: TASK-243
title: 'Feature: additive schema evolution (new indexed fields on existing tables)'
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
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
`CREATE TABLE IF NOT EXISTS` never adds generated columns, so adding an indexed field to an existing collection breaks queries with "no such column". Bun 1.4.4 fixed stale statements after ALTER TABLE; still flush StrataDB's own statement cache. Audit refs: A10, 1B-B1.

## Implementation
1. On collection open, read `PRAGMA table_xinfo("<table>")`. For each schema-indexed field missing a column, run `ALTER TABLE ... ADD COLUMN "_x" <type> GENERATED ALWAYS AS (jsonb_extract(body, '$.x')) VIRTUAL` (SQLite allows this for VIRTUAL), then create its index.
2. Removed or type-changed fields: emit a warning via an `onSchemaDrift` option; an option to fail instead.
3. After DDL, clear the statement cache (and call `db.clearQueryCache()` if `db.query` is used anywhere).
4. Flip regression case A10.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Regression case A10 passes: reopening a collection with a new indexed field adds the column and index and queries on it work
- [ ] #2 Removed or changed fields trigger onSchemaDrift (or a configurable error) instead of silent misbehavior (tests)
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
