---
id: TASK-245
title: 'Feature fix: $elemMatch on arrays of objects'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-10T00:48:00Z'
labels:
  - api
milestone: m-2
dependencies:
  - TASK-242
documentation:
  - stratadb-audit.md
priority: medium
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
`$elemMatch` with field keys (arrays of objects) produces `WHERE ` with an empty condition, a SQL syntax error. Audit ref: A12.

## Implementation
Non-`$` keys inside `$elemMatch` become sub-paths `json_extract(json_each.value, ?)`, recursing through the normal field-condition translator; `$` operators apply to `json_each.value` as today. Flip regression case A12 and enable the skipped test at test/integration/complex-queries.test.ts:358.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Regression case A12 passes and the previously skipped $elemMatch integration test is enabled and passes
- [x] #2 Nested operators inside $elemMatch (e.g. { qty: { $gte: 2 } }) work (tests)
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add real SQLite object-element, nested operator/path, nested array, logical, null/presence, mixed-scalar and injection regressions before implementation; enable the existing skipped integration case.
2. Reuse field-condition translation with a validated element-relative resolver, unique correlated aliases and array/object guards. Preserve scalar elemMatch and strict validation.
3. Convert both A12 cases to ordinary tests, document supported forms, run all host gates and local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Object elemMatch fields and dotted paths reuse the ordinary field-condition translator with an element-relative FieldResolver root. Nested arrays use distinct deterministic correlated aliases; array and object guards prevent parsing scalar strings and prevent scalar/null elements from satisfying object-field filters. Scalar operator forms remain supported. Element logical filters use strict recursive validation.
- Shared NOT/NOR translation normalizes unknown SQL comparisons to false before negation, so missing paths behave consistently inside and outside an element. Breaking change: negated filters may now include null/missing comparisons; add exists:true when presence is required. Documented in CHANGELOG and the query guide. Exact SQL assertions updated to retain full SQL/binding checks.
- Regression-first matrix initially produced 41 failures and 12 passing scalar controls across indexed/unindexed and cache on/off combinations. Final 57-case matrix covers same-element conjunction, numeric/nested operators, dotted fields, null/presence/missing, nested object and scalar arrays, logical branches/negation, heterogeneous elements and injection/unknown/malformed rejection. Both A12 audit cases are ordinary passing tests; enabled the skipped complex elemMatch integration case and corrected its obsolete JSON schema storage type to BLOB.
- Host gate PASS: 959 pass, 1 existing projection skip owned by TASK-253, 0 fail; TS 7.0.2 typecheck; lint; build; type tests; consumer TS 6/7 CRUD; source TS 5.9.3/6.0.3. Only A15/TASK-246 remains test.failing. Local CI pending committed SHA.
<!-- SECTION:NOTES:END -->
