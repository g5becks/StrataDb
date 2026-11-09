---
id: TASK-237
title: 'Semantics: correct null equality, $ne and $nin handling'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T18:43:00Z'
labels:
  - api
milestone: m-1
dependencies:
  - TASK-229
documentation:
  - stratadb-audit.md
priority: high
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
`{ field: null }` emits `field = NULL`, which never matches. `$ne: null` never matches. `$ne: v` excludes documents where the field is null or missing (SQL three-valued logic). Audit ref: A11.

## Implementation
1. `null` equality → `IS NULL`; decide and document whether it matches missing fields (MongoDB: yes; recommended: yes, `jsonb_type(...) IS NULL`).
2. `$ne: null` → `IS NOT NULL`.
3. `$ne: v` → `(field IS NULL OR field <> ?)`; `$nin` gets the same treatment.
4. Add a "Semantics vs MongoDB" section to docs/guide covering these rules.
5. Flip regression case A11. Enable the skipped test at test/integration/complex-queries.test.ts:793.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Regression case A11 passes and the previously skipped null/undefined integration test is enabled and passes
- [x] #2 Documented semantics for null, missing fields, $ne and $nin exist in docs/guide and match tests
- [x] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change (Breaking changes section)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add indexed/unindexed/cache tests for null, missing, negative equality and membership, and enable the existing null integration case before fixing.
2. Emit explicit IS NULL/IS NOT NULL branches and define null-containing $nin semantics; retain correct cache binding paths.
3. Convert A11, document semantics and migration with primary MongoDB references, and run all quality gates plus local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Null equality/$eq now use IS NULL and match explicit null plus missing fields. $ne:null uses IS NOT NULL; $ne:non-null and non-null $nin lists include null/missing values. Empty $nin matches all; null-containing lists exclude null/missing and their other values. This scalar membership choice is explicitly documented.
- Corrected cache parameter descriptors for omitted null operands and filtered null entries, including repeated field paths. A11 cases and the previously skipped integration test now run as normal tests.
- Regression-first matrix: four failures before; now indexed/unindexed and cached/uncached queries agree across 15 cases, repeated cache hits and a bulk update. Exact SQL/parameter assertions updated and preserved.
- Breaking change: bulk filters may match additional null/missing documents; review filters during migration. Added the Semantics vs MongoDB guide section with primary MongoDB documentation links and explicit StrataDB decisions.
- Host gate PASS: typecheck TS 7.0.2; lint 100 files; 871 pass/2 existing skips/0 fail; build; type tests; consumer TS 6/7 and CRUD; source TS 5.9.3/6.0.3. Local CI pending committed SHA. Follow-ups: none.

Verified with scripts/ci-local.sh (cf9b5adc005c522d8a595107af2f1b472c9cf80a, PASS); GitHub Actions unavailable (billing lock). macOS/Linux pinned/latest Bun 1.4.4 PASS; TS 5.9.3/6.0.3/7.0.2 source/type tests PASS; TS 7.1.0-beta advisory PASS. Logs: /Users/takinprofit/Dev/StrataDb-release/ci-local/cf9b5ad/logs. Self-review complete.
<!-- SECTION:NOTES:END -->
