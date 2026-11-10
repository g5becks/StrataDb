---
id: TASK-272
title: 'Semantics: Unicode-aware case-insensitive matching for $ilike and text search'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-10T16:03:00Z'
updated_date: '2026-11-10T16:10:00Z'
labels:
  - semantics
  - breaking
milestone: m-3
dependencies:
  - TASK-271
priority: medium
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
SQLite's `lower()` and `LIKE` only fold ASCII. Measured on main (2026-11-10): with documents `Émile`, `ÉMILE` and `emile`, `{ name: { $ilike: '%émile%' } }` matches **none** of them. The same `lower(...) LIKE lower(...)` translation backs text search with `caseSensitive: false` (`src/collection-read-ops.ts`). The audit (§1B-B2, SDB-47) planned a UDF for this; only the `$regex` half shipped (TASK-256).

## Implementation
1. Add regression tests first (Latin accents, Greek, Cyrillic, German ß, Turkish dotted/dotless i), covering both `$ilike` and case-insensitive search.
2. Register a deterministic UDF the same way `src/sqlite-regex.ts` does, once per `Database`, for example `strata_casefold(text)` returning `value.normalize("NFC").toLowerCase()` (locale-independent). For non-strings, keep current behavior.
3. Translate `$ilike` to `strata_casefold(field) LIKE strata_casefold(?) ESCAPE '\'`, and case-insensitive search to the same form, keeping the existing LIKE escaping. Check that statement caching (TASK-252) and the query-template cache (TASK-263) still work.
4. Update the docs (`query-types.ts` JSDoc currently says "ASCII case folding", the README and the semantics page) and the CHANGELOG. Matching broadens for non-ASCII text, so list it under Breaking changes.
5. Benchmark `$ilike` and search before and after. Record the numbers; a slowdown is acceptable but must be documented.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 $ilike '%émile%' matches Émile, ÉMILE and émile; Greek and Cyrillic case pairs match; the ASCII behavior is unchanged
- [ ] #2 Text search with caseSensitive false uses the same Unicode folding; caseSensitive true is unchanged
- [ ] #3 The UDF is registered once per Database, deterministic, and works with statement caching and read-only databases
- [ ] #4 Docs, JSDoc and CHANGELOG (Breaking changes) describe the new folding; benchmark before/after recorded in notes
- [ ] #5 Quality gate and scripts/ci-local.sh pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add Unicode regressions for ilike/search, literal escaping, caches, UDF registration and readonly; benchmark old behavior.
2. Register deterministic NFC/toLowerCase UDF once per connection and use it for both query paths; update semantics, JSDoc and migration notes.
3. Record before/after performance and run all required checks plus ci-local before closing.
<!-- SECTION:PLAN:END -->
