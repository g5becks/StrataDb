---
id: TASK-243
title: 'Feature: additive schema evolution (new indexed fields on existing tables)'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T20:48:00Z'
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
- [x] #1 Regression case A10 passes: reopening a collection with a new indexed field adds the column and index and queries on it work
- [x] #2 Removed or changed fields trigger onSchemaDrift (or a configurable error) instead of silent misbehavior (tests)
- [x] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the existing A10 regression with real file-backed reopen, generated-column/index introspection, drift callback/error, and DDL rollback cases before implementation.
2. Add missing VIRTUAL generated columns atomically on open, report removed/type-changed generated columns through configurable drift handling, and clear Bun query caches after DDL.
3. Document additive evolution and drift policy, run all host gates, then commit and verify local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Opening a collection inspects table_xinfo and adds missing indexed VIRTUAL generated columns before creating indexes, in an immediate atomic DDL transaction. Existing rows and dotted indexed fields are queryable immediately. Bun query caches are cleared after successful DDL; StrataDB has no statement cache yet (TASK-252 owns its future invalidation).
- Database onSchemaDrift accepts a callback or "error"; the default is console.warn. Removed and stored-type-changed generated columns are retained, never rewritten; strict mode aborts before any migration. BOOLEAN/INTEGER share the stored SQLite representation. Unindexed properties have no stored declaration to compare. Both collection creation paths use this database-level policy.
- Regression-first tests: the original A10 and three new cases exposed missing-column query results/absent drift callbacks/absent strict rejection. Additional investigation reproduced an existing SQLite DQS constant-index hazard (integrity_check reported a row missing from the index after ALTER TABLE). A new regression failed before repairing affected single/compound indexes during migration and now verifies exact results and integrity_check=ok. Unique-index failure rollback and real two-connection DDL-lock typed errors are covered. A10 is now an ordinary passing test.
- Breaking change: none. Documented additive evolution, drift policy and rollback behavior in the schema guide and CHANGELOG. Host gate PASS: 897 pass, 2 existing skips, 0 fail; lint; TS 7.0.2 typecheck; build; type tests; consumer TS 6/7 CRUD; source TS 5.9.3/6.0.3. Local CI pending committed SHA.

- Verified with scripts/ci-local.sh (58e23ea7e277fb2c927adc2e43586fbba5616c1f, PASS); GitHub Actions unavailable (billing lock). All macOS/Linux Bun and required/advisory TypeScript jobs passed.
<!-- SECTION:NOTES:END -->
