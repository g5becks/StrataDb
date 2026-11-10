---
id: TASK-264
title: 'Docs: expose public signature types and eliminate TypeDoc warnings'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T20:17:00Z'
updated_date: '2026-11-10T13:25:00Z'
labels:
  - docs
milestone: m-2
dependencies:
  - TASK-241
documentation:
  - stratadb-audit.md
priority: medium
type: docs
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-241 docs build succeeds, but TypeDoc reports named public signature/context types omitted from the root exports: CollectionOptions, RetryableOptions and SQLiteErrorContext. It also reports duplicate remarks/returns tags on Collection.search. Expose and document the named types without removing compatibility exports, correct duplicate tags, and regenerate the final API pages after the DX changes. The VitePress chunk-size advisory is separate and must not be suppressed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Named public signature/context types are importable from stratadb and have generated API documentation
- [x] #2 Duplicate comment tags and TypeDoc not-exported/link warnings are resolved without suppressing validation
- [x] #3 docs:build and the full quality gate pass; generated API links and formatting are reviewed
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inventory current public signature/link warnings and duplicate comments after the module split.
2. Expose named public context/options/helper types with precise docs and root type-import assertions, resolve contract expansion without suppressing validation, and regenerate API pages.
3. Review generated links/formatting, require a warning-free TypeDoc build, run all host gates and committed local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Outcome: exported CollectionOptions, RetryableOptions, SQLiteErrorContext, five collection contract groups and the AtomicUpdate helper types UpdatePath/ArrayValue from the package root. Named types have API pages and meaningful comments; Collection links to each method family. Removed the malformed duplicated insertOne comment and corrected body/UUID metadata wording.
- Breaking change: none; exports are additive and runtime behavior is unchanged.
- Verification: docs:build PASS with zero TypeDoc warnings/errors, without disabling validation or suppressing links. VitePress chunk-size advisory remains. Public root type assertions and packed consumer imports verify options/context types; full host gate PASS with1052 tests/6460 assertions/no failures/skips, source TS5.9.3/6.0.3/7.0.2, lint, build, type tests and packed consumer TS6/7+CRUD.
- Decisions: expose useful named contract groups and link their method pages rather than expanding every collection reference recursively. Historical proposals remain explicitly historical.
- Sources reviewed: https://typedoc.org/documents/Tags._inline.html and Tags._expand.html; explicit exported contracts provide stable documentation references.
- Follow-ups: none. Committed local CI and source-linked API regeneration pending.

- Verified with scripts/ci-local.sh (fb2fd55294542cd2ce060c745e0811f89c794ed6, PASS); GitHub Actions unavailable (billing lock). macOS/Linux Bun pinned/latest1.4.4, TS5.9.3/6.0.3/7.0.2 and advisory7.1-beta all PASS.
- Regenerated API from the committed source: docs build PASS, zero TypeDoc warnings, links checked against fb2fd55. Separate contract pages expose all methods and overloads; Collection links to all five groups. All named options/context/helper types have generated pages.
<!-- SECTION:NOTES:END -->
