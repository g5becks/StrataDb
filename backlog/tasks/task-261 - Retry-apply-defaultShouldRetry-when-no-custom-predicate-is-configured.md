---
id: TASK-261
title: 'Retry: apply defaultShouldRetry when no custom predicate is configured'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T13:23:00Z'
updated_date: '2026-11-09T20:31:00Z'
labels:
  - api
milestone: m-1
dependencies:
  - TASK-223
priority: medium
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
During TASK-223, source inspection confirmed withRetry forwards shouldRetry only when explicitly configured; otherwise p-retry retries all errors. The errno classifier fix is effective when selected, but the default policy still retries validation and unknown errors. Wire the classifier as the default in the documented v0.6 behavior-change window, preserving custom predicates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Default retries stop after the first validation, constraint or unknown error
- [x] #2 Default retries recover from a real SQLITE_BUSY error after lock release without supplying shouldRetry
- [x] #3 Custom shouldRetry overrides remain effective and the behavior change is documented
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add default-policy rejection and custom-override cases before fixing; retain the real two-connection SQLITE_BUSY fixture without an explicit predicate.
2. Wire defaultShouldRetry when no predicate is configured, preserving explicit overrides and retry consumption tests.
3. Update README/retry/migration docs and Breaking changes, then run all host gates and local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- withRetry now supplies defaultShouldRetry whenever no predicate is configured. Explicit shouldRetry remains authoritative, including custom retries for application errors and custom stop decisions for ConnectionError. Retries remain disabled by default.
- Regression-first new suite: six default-policy failures before the fix; all eight cases pass after it. Validation/schema/constraint/unique/query/unknown errors are attempted once. Real two-connection SQLITE_BUSY recovery now omits shouldRetry and still succeeds with wrapped errno/cause assertions.
- Preserved the retry-consumption unit test by explicitly allowing its intentionally unknown error. Strengthened the transaction-option forwarding fixture with a custom database predicate, so retry:false forwarding remains independently verified after the new default.
- Breaking change: enabling retries no longer retries every error by default. Updated README, retry guide, migration before/after examples and CHANGELOG.
- Host gate PASS: typecheck TS 7.0.2; lint 104 files; 882 pass/2 existing skips/0 fail; build; type tests; consumer TS 6/7 and CRUD; source TS 5.9.3/6.0.3. Focused retry/lock/transaction cases rerun after test-strengthening. Local CI pending committed SHA.

- Verified with scripts/ci-local.sh (0033bda2753cfee168365b57f2b5e1f4cc5412ee, PASS); GitHub Actions unavailable (billing lock). macOS/Linux Bun pinned/latest 1.4.4 and TypeScript 5.9.3/6.0.3/7.0.2 plus advisory 7.1.0-beta all pass.
<!-- SECTION:NOTES:END -->
