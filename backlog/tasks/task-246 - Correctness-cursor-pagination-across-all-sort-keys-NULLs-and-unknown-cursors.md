---
id: TASK-246
title: 'Correctness: cursor pagination across all sort keys, NULLs and unknown cursors'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-10T00:56:00Z'
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
An unknown cursor id silently returns the first page. Only the first sort key is used. NULL sort values are skipped. There is no `_id` tie-breaker in ORDER BY. Audit ref: A15.

## Implementation
1. Unknown cursor → QueryError (or an explicit `invalidCursor` result; decide and document).
2. Build a lexicographic tuple comparison across all sort keys plus `_id`; always append `_id` to ORDER BY when a cursor is used.
3. Define NULL ordering (NULLS FIRST for asc, or configurable) and include it in the comparison.
4. Property test: random data with duplicates and NULLs, random multi-key sorts; walking pages yields every row exactly once.
5. Flip regression case A15.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Regression case A15 passes (unknown cursor is an error)
- [x] #2 A property test over random datasets and multi-key sorts proves pagination returns every row exactly once
- [x] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add seeded fast-check forward/backward cursor walks against an independent comparator over duplicate/null/missing multi-key data, plus invalid-cursor contract tests before fixing.
2. Build lexicographic predicates over every sort key plus a deterministic _id tie-breaker, explicit null ordering and nearest previous-page queries. Reject malformed/unknown cursors and missing sort.
3. Convert A15 to an ordinary test, update cursor docs and compatibility assertions, run all host gates and local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Cursor predicates now compare all sort keys lexicographically with null-safe equal prefixes, explicit NULLS FIRST ascending/NULLS LAST descending, and a stable ascending _id tie-breaker unless _id is explicitly sorted. Every sorted find uses that tie-breaker, including the first page. before selects the nearest previous page in reversed SQL order and restores the requested output order. A boundary row may be outside the active filter but must exist.
- Malformed/unknown cursors, both after and before, empty IDs and a missing/empty sort reject with QueryError. A15 is now an ordinary passing test; no audit test.failing remains. Existing invalid-cursor success assertions were replaced with the stricter documented rejection contract; exact ORDER BY assertions retain explicit SQL/bind checks.
- Added fast-check 4.10.2 (also available for TASK-251) and committed bun.lock after bun install. The regression-first property failed before the fix with a shrunk duplicate/null counterexample; invalid cursor checks also failed. Final seeded property (20261109, 250 runs) independently sorts generated records and walks every row exactly once forward/backward across duplicate/null/missing values, nested paths, random multi-key directions, explicit ID sorts, indexed/unindexed schemas and random page sizes.
- Breaking change: invalid cursors no longer return the first page; missing-sort cursors no longer disappear; tied sort order is deterministic, and before returns the nearest previous page. CHANGELOG, query guide and CursorSpec comments document migration and semantics.
- Host gate PASS: 961 pass, 1 existing projection skip (TASK-253), 0 fail; TS 7.0.2 typecheck; lint; build; type tests; consumer TS 6/7 CRUD; source TS 5.9.3/6.0.3. Local CI pending committed SHA.

- Verified with scripts/ci-local.sh (fef095f425f3d7a69336d80399dc93401dc6b985, PASS); GitHub Actions unavailable (billing lock). All macOS/Linux Bun and required/advisory TypeScript jobs pass.
<!-- SECTION:NOTES:END -->
