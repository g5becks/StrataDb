---
id: TASK-238
title: 'Semantics: LIKE-family escaping and real case sensitivity'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T20:04:00Z'
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
- [x] #1 Regression case A13 passes: $like is case-sensitive, $ilike is not, search caseSensitive:true is honored
- [x] #2 Literal % _ and backslash in $contains/$startsWith/$endsWith/search are matched literally (tests)
- [x] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change (Breaking changes section)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add real indexed/unindexed string-matching cases for case, wildcard literals, backslashes, glob metacharacters, empty strings and ASCII/Unicode behavior.
2. Translate case-sensitive LIKE patterns to escaped GLOB; use exact substring/prefix/suffix operations; escape literal case-insensitive search with an explicit ESCAPE clause.
3. Preserve cache parameter correctness, convert A13, update exact SQL/behavior expectations and document migration.
4. Run all host gates and local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Case-sensitive $like now translates SQL wildcards into escaped GLOB patterns; literal glob metacharacters stay literal. $contains uses instr; prefix/suffix operations compare exact substrings. Search text escapes literal percent/underscore/backslash and uses an explicit ESCAPE clause; case-sensitive search uses instr.
- $ilike and default search explicitly lower both operands for ASCII folding, including when an external case_sensitive_like pragma is enabled. Unicode case is preserved by the default SQLite engine. String-sugar/transformed-pattern queries bypass raw-value translator cache extraction; prepared SQL remains parameterized.
- All A13 cases now pass as normal tests. Regression-first indexed/unindexed suite failed before; now covers repeat calls, wildcard literals, backslashes, glob syntax, empty strings, ASCII/Unicode and pragma independence. Exact SQL/bind assertions remain exact; changed the prior case-insensitive contains test to require exact matching names.
- Breaking change: case-sensitive operators and literal search/substrings now honor their intended semantics. Query guide and CHANGELOG document migration and SQLite limits with primary references.
- Host gate PASS: typecheck TS 7.0.2; lint 102 files; 873 pass/2 existing skips/0 fail; build; type tests; consumer TS 6/7 and CRUD; source TS 5.9.3/6.0.3. Local CI pending committed SHA. Follow-ups: none.

Verified with scripts/ci-local.sh (f1a7363defa0a9c7abd0ce86c7e289ebf9976dba, PASS); GitHub Actions unavailable (billing lock). macOS/Linux pinned/latest Bun 1.4.4 PASS; TS 5.9.3/6.0.3/7.0.2 source/type tests PASS; TS 7.1.0-beta advisory PASS. Logs: /Users/takinprofit/Dev/StrataDb-release/ci-local/f1a7363/logs. Self-review complete.
<!-- SECTION:NOTES:END -->
