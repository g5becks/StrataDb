---
id: TASK-238
title: 'Semantics: LIKE-family escaping and real case sensitivity'
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
priority: medium
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
SQLite LIKE is ASCII case-insensitive, so `$like` equals `$ilike`. `search({ caseSensitive: true })` is ignored. `$contains`/`$startsWith`/`$endsWith`/search do not escape `%` and `_` (repro: `$startsWith: "_"` matched every row). Audit ref: A13.

## Implementation
1. Escape user text with `replace(/[\\%_]/g, "\\$&")` and add `ESCAPE '\'`.
2. Case-sensitive variants (`$like`, `$contains`, `$startsWith`, `$endsWith`, search with caseSensitive) use exact comparisons:
   - `$startsWith`: `substr(field, 1, length(?)) = ?`;
   - `$endsWith`: `substr(field, -length(?)) = ?`;
   - `$contains`: `instr(field, ?) > 0`;
   - `$like`: `GLOB` with an escaped translation.
3. Case-insensitive variants keep LIKE. Document the ASCII-only folding.
4. Flip regression case A13.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Regression case A13 passes: $like is case-sensitive, $ilike is not, search caseSensitive:true is honored
- [ ] #2 Literal % _ and backslash in $contains/$startsWith/$endsWith/search are matched literally (tests)
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change (Breaking changes section)
<!-- AC:END -->
