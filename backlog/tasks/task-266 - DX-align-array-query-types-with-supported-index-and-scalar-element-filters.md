---
id: TASK-266
title: 'DX: align array query types with supported index and scalar element filters'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-10T01:40:00Z'
updated_date: '2026-11-10T13:32:00Z'
labels:
  - api
milestone: m-2
dependencies:
  - TASK-245
  - TASK-251
documentation:
  - stratadb-audit.md
priority: medium
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
While implementing Q4 differential coverage (TASK-251), source inspection found ArrayOperator declares $index as number although the validated runtime requires {index, condition}; scalar $elemMatch is declared QueryFilter<U>, which describes object fields instead of numeric/string element operators. Align the public types with the verified runtime and A12 element support without loosening malformed-value checks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Type tests accept $index objects with typed scalar/operator conditions and reject the obsolete numeric shorthand and malformed shapes
- [x] #2 Type tests accept scalar numeric/string and nested object $elemMatch filters with appropriate operand types
- [x] #3 Runtime behavior and validation remain unchanged; full quality gate and local CI pass; documentation and CHANGELOG identify the corrected types
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add compiler regressions for actual index objects, scalar element operators and typed object filters, including obsolete/malformed inputs.
2. Correct only ArrayOperator type declarations and examples; preserve runtime validation and SQL. Mark removal of numeric shorthand as a type-level breaking change.
3. Update docs/changelog and exact existing type assertions, run source/type/consumer gates on supported TS versions and local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Outcome: ArrayOperator.$index accepts {index, condition} with typed scalar/operator conditions, and $elemMatch accepts scalar/array operators or typed object-field queries. Fixed the obsolete guide example and exact index-shape type assertion; generated API regenerated. Runtime SQL/validation files are unchanged.
- Breaking change: numeric $index shorthand now fails type checking, matching its existing runtime rejection. Migrate to {index:0,condition:valueOrOperators}; nonnegative integer validation is unchanged.
- Regression-first: supported index objects failed compilation, numeric shorthand and mistyped scalar element operands produced unused negative assertions before the fix. All positive/negative cases now pass, including nested arrays/object dotted paths, missing condition, wrong index/operand types.
- Verification: full host gate PASS with1055 tests/no failures/skips. Source and type suites PASS on TS5.9.3/6.0.3/7.0.2; lint, build, packed consumer TS6/7+CRUD PASS. docs:build PASS with zero TypeDoc validation warnings; VitePress chunk advisory retained. Query type source584 lines, preserving the refactor size limit. Committed local CI pending.
- Decisions: index literal conditions are scalar; nested element operator forms retain their element types. No runtime acceptance was loosened.
- Follow-ups: none.

Verified with scripts/ci-local.sh (c4164c66e89286fd5fd03c1688514e73f0c5fd39, PASS); GitHub Actions unavailable (billing lock). macOS/Linux Bun pinned/latest1.4.4, source/type suites TS5.9.3/6.0.3/7.0.2 and advisory7.1-beta all PASS.
<!-- SECTION:NOTES:END -->
