---
id: TASK-235
title: 'Feature fix: actually create compound indexes (unique and non-unique)'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - api
milestone: m-1
dependencies:
  - TASK-228
documentation:
  - stratadb-audit.md
priority: high
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
`compoundIndex()` is stored on the schema but never created in SQLite (sqlite-collection.ts never reads `compoundIndexes`). Repro: no index exists, and a unique compound index accepts duplicates. agentx declares 5 compound indexes. Audit ref: A8.

## Implementation
1. In createIndexes, create `CREATE [UNIQUE] INDEX IF NOT EXISTS "<idx>" ON "<table>"(<cols>)` for each compound index. Each column is the generated column for indexed fields, otherwise the `jsonb_extract(body, '$.path')` expression. Use the FieldResolver; JSON paths in index expressions must be literals, so build them from validated segments only.
2. Use deterministic, collision-safe index names (e.g. `idx_<table>_<name>`).
3. Flip regression case A8. Add tests that inspect `PRAGMA index_list`/`index_xinfo` and use `EXPLAIN QUERY PLAN` to show the index is used.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Regression case A8 passes: PRAGMA index_list shows the compound index, and a unique compound index rejects duplicates with UniqueConstraintError
- [ ] #2 Compound indexes over dotted (nested) fields are created and used (EXPLAIN QUERY PLAN test)
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
