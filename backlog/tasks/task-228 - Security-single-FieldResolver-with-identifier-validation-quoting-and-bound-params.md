---
id: TASK-228
title: >-
  Security: single FieldResolver with identifier validation, quoting and bound
  params
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
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
- [ ] #1 All SQL identifiers and JSON paths are produced by one module; grep finds no template-literal interpolation of field names, limit, skip or $index into SQL in src/
- [ ] #2 Regression cases A1 (filter key, $index, limit injection) and A16 (collections named order and user-data) pass as normal tests
- [ ] #3 An injection corpus test over filter keys, sort keys, search fields, $index, limit and skip asserts QueryError and never returns extra rows
- [ ] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change (Breaking changes section)
<!-- AC:END -->
