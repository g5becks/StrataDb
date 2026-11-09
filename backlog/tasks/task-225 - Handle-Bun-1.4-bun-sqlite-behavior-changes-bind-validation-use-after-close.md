---
id: TASK-225
title: Handle Bun 1.4 bun:sqlite behavior changes (bind validation, use-after-close)
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - api
milestone: m-0
dependencies:
  - TASK-215
references:
  - src/sqlite-query-translator.ts
  - src/stratadb.ts
documentation:
  - stratadb-audit.md
priority: medium
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Bun 1.4.x changed several bun:sqlite behaviors (audit 1B-B1):
- binding a Date/Map/Promise now throws TypeError instead of binding NULL. The `$index` operator pushes `condition` without `toBindValue` (src/sqlite-query-translator.ts ~935), so a raw TypeError leaks (and on Bun 1.3 a silent NULL was bound);
- `db.close()` now finalizes every cached statement, so using a collection after `close()` throws a confusing "Statement has finalized".

## Implementation
1. Route every value bound by the translator (including `$index` conditions) through `toBindValue` so unsupported types raise QueryError consistently.
2. Track closed state in Strata/collections; any operation after `close()` rejects with a StrataDB error (e.g. ConnectionError "database is closed").
3. Add tests for both. Document the `changes` counting change (trigger/cascade rows no longer counted on Bun 1.4.4) in the docs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 find({ tags: { $index: { index: 0, condition: new Date() } } }) rejects with QueryError (not TypeError) on Bun 1.4.4
- [ ] #2 Calling any collection method after db.close() rejects with a StrataDB error class whose message says the database is closed
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
