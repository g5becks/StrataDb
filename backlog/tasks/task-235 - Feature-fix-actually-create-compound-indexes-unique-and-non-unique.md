---
id: TASK-235
title: 'Feature fix: actually create compound indexes (unique and non-unique)'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T18:32:00Z'
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
- [x] #1 Regression case A8 passes: PRAGMA index_list shows the compound index, and a unique compound index rejects duplicates with UniqueConstraintError
- [x] #2 Compound indexes over dotted (nested) fields are created and used (EXPLAIN QUERY PLAN test)
- [x] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add schema/index introspection, uniqueness, dotted-field query-plan and collision tests before implementation.
2. Create declared compound indexes with validated DDL field expressions and deterministic collision-safe names.
3. Convert both A8 cases, document SQLite expression-index behavior and run all host gates plus local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Create every declared compound index using generated columns for indexed fields and validated literal JSON expressions otherwise. DDL cannot bind paths, so resolution remains in field-resolver.ts. Compound index names encode table/name lengths to prevent cross-table aliases and quote all identifiers.
- A8 cases now pass as normal tests. Regression-first new suite had 3 failures before; now validates ordered PRAGMA index_xinfo columns, unique nested expression enforcement, hostile/colliding names, and EXPLAIN QUERY PLAN use of the actual translated dotted-field query.
- Breaking change: formerly ignored unique compound declarations now enforce constraints; existing duplicate tuples must be cleaned before reopening. SQLite NULL uniqueness semantics are retained. Bound JSON-path filters can limit expression-index matching; mark constituent fields indexed to use full compound keys in translated queries.
- Host gate PASS: typecheck TS 7.0.2; lint 98 files; 863 pass/3 existing skips/0 fail; build; type tests; consumer TS 6/7 and CRUD; source TS 5.9.3/6.0.3. Local CI pending committed SHA. Follow-ups: none.

Verified with scripts/ci-local.sh (c434dad208d904ca6b0589f242ca0a84636eacd9, PASS); GitHub Actions unavailable (billing lock). macOS/Linux pinned/latest Bun 1.4.4 PASS; TS 5.9.3/6.0.3/7.0.2 source/type tests PASS; TS 7.1.0-beta advisory PASS. Logs: /Users/takinprofit/Dev/StrataDb-release/ci-local/c434dad/logs. Self-review complete.
<!-- SECTION:NOTES:END -->
