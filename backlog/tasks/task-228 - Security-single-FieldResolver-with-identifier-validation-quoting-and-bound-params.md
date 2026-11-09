---
id: TASK-228
title: >-
  Security: single FieldResolver with identifier validation, quoting and bound
  params
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T17:57:00Z'
labels:
  - api
milestone: m-1
dependencies:
  - TASK-227
references:
  - src/sqlite-query-translator.ts
  - src/sqlite-collection.ts
documentation:
  - stratadb-audit.md
priority: high
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
**SQL injection (Critical).** Field names are interpolated into SQL in 5 places: translator `resolveFieldName`; collection `buildSearchClause`, `buildSortClause`, `buildCursorClause`; and `createTable`/`createIndexes` DDL. `$index.index`, `limit` and `skip` are interpolated too (find() bypasses `translateOptions`). Repros: a crafted filter key and a crafted `$index` both returned all rows. Audit refs: A1, A16, C1, C2.

## Implementation
1. Add `src/field-resolver.ts`:
   - `resolveField(name, schema)` validates each path segment against `^[A-Za-z_][A-Za-z0-9_]*$` (QueryError otherwise);
   - returns either a quoted generated-column identifier (`"_name"`) or `jsonb_extract(body, ?)` with the JSON path as a bound parameter;
   - helpers `quoteIdent()` (double quotes, escape `"` as `""`) and `assertNonNegativeInt()`.
2. Use it in all 5 SQL builders, and in DDL for table, column and index names.
3. `limit`, `skip` and `$index.index`: validate with `Number.isSafeInteger(x) && x >= 0` and bind as parameters.
4. Remove `translateOptions()` or make find() use it, so only one options path remains.
5. Validate collection names at `db.collection()` (allow any name, but quote it everywhere; reject empty names).
6. Map dotted indexed fields to safe column names (e.g. `_profile__city`).
7. Flip regression cases A1 and A16 to `test`. Add an injection corpus test covering filter keys, sort keys, search fields, `$index`, limit and skip.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All SQL identifiers and JSON paths are produced by one module; grep finds no template-literal interpolation of field names, limit, skip or $index into SQL in src/
- [x] #2 Regression cases A1 (filter key, $index, limit injection) and A16 (collections named order and user-data) pass as normal tests
- [x] #3 An injection corpus test over filter keys, sort keys, search fields, $index, limit and skip asserts QueryError and never returns extra rows
- [x] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change (Breaking changes section)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Centralize field-path validation, identifier quoting, DDL expressions and numeric option validation.
2. Route translator and collection SQL paths through the resolver with bound paths/values; preserve cache parameter correctness.
3. Add hostile-input corpus for every identifier entry point, convert A1/A16 cases, document migration, and run quality gates plus local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Central field resolver validates paths, quotes identifiers, maps dotted generated columns without collisions, binds JSON paths and numeric options, and expands repeated expression bindings in SQL order. SQLite DDL forbids parameters, so its sole validated path-literal builder is in field-resolver.ts.
- find uses translator.translateOptions; search/cursor/distinct share resolution. Cache stores path parameters and encoded value-path segments; preserves filter traversal order. String sugar bypasses raw-value template extraction to avoid changing wrapped bind values.
- Breaking change: punctuation in field paths and invalid numeric options now reject; empty/NUL collection names reject. Other collection names are quoted and supported. CHANGELOG describes migration.
- Host verification PASS: typecheck TS 7.0.2; lint 87 files; 785 pass, 3 existing skips, 0 fail; build; type tests; consumer TS 6/7 with skipLibCheck:false and CRUD; source TS 5.9.3/6.0.3. Exact SQL/parameter expectations updated without removing assertions. Local CI pending committed SHA.

- Verified with scripts/ci-local.sh (957dd63159b0a62c1d87cc12a5d3148d5e33c607, PASS); GitHub Actions unavailable (billing lock). macOS/Linux pinned/latest Bun 1.4.4 PASS; source/type-test TS 5.9.3, 6.0.3, 7.0.2 PASS; TS 7.1.0-beta advisory PASS. Logs: /Users/takinprofit/Dev/StrataDb-release/ci-local/957dd63/logs. actionlint PASS.
- Self-review: raw user identifiers no longer enter SQL; the only literal JSON-path builder is the validated DDL helper. Exact regression cases and hostile corpus pass. No follow-up required.
<!-- SECTION:NOTES:END -->
