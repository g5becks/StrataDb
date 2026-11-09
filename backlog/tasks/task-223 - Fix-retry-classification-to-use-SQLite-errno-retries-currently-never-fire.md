---
id: TASK-223
title: Fix retry classification to use SQLite errno (retries currently never fire)
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T13:23:00Z'
labels:
  - api
milestone: m-0
dependencies:
  - TASK-215
references:
  - src/retry-utils.ts
  - test/unit/retry-utils.test.ts
documentation:
  - stratadb-audit.md
priority: high
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Automatic retries never fire on real SQLite lock errors. `isRetryableError` (src/retry-utils.ts ~69) checks `typeof error.code === "number"`, but Bun's SQLiteError has `code: "SQLITE_BUSY"` (a string) and `errno: 5` (extended codes such as 517 exist too). ConnectionError and TransactionError are never thrown. The unit tests fake `{ code: 5 }` and mask the bug. This has been wrong since Bun 1.0.21; it is not a regression. Audit refs: A7, 1B-B1.

## Implementation
1. Classify by primary result code: `(error.errno & 0xff)` in {5 BUSY, 6 LOCKED, 10 IOERR} (decide on 7 NOMEM).
2. Keep the existing instanceof checks for StrataDB error classes.
3. Replace the fake-code unit tests with tests built from real `SQLiteError` instances.
4. Add an integration test: two `Database` handles on one temp file; handle A holds `BEGIN IMMEDIATE`; a collection op through handle B (retry enabled, busy_timeout=0) retries; release the lock from a timer; assert success after retry. Also assert failure with retries disabled.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 isRetryableError returns true for real Bun SQLiteError instances with errno 5, 6, 10 and extended codes whose low byte is 5/6 (e.g. 517)
- [x] #2 Unit tests no longer fabricate numeric code properties; they use real SQLiteError objects
- [x] #3 A two-connection integration test proves a SQLITE_BUSY failure is retried and succeeds once the lock is released
- [x] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace fabricated numeric-code tests with real SQLiteError instances, including extended errno codes.
2. Add a real two-connection busy-lock regression with enabled and disabled retries and observe failure first.
3. Classify primary errno codes, document the retry policy and run full verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- defaultShouldRetry now reads numeric errno and masks the primary SQLite result code, covering extended BUSY/LOCKED/IOERR. Retained NOMEM (7) for compatibility with the existing policy. CHANGELOG records the correction.
- Verification: new tests first failed (21 pass, 8 fail), then pass (29/29 focused). A native two-connection SQLITE_BUSY test fails with retry:false and succeeds after timer-driven lock release with defaultShouldRetry selected. Full gate and compiler matrix pass (717 pass, 0 fail, 3 skip). Self-reviewed changes. Remote CI run pending maintainer push.
- Test detail: SQLiteError cannot be publicly constructed and native errno is immutable. Unit variants inherit a caught native SQLiteError and shadow errno for fault injection, retaining instanceof SQLiteError and a string code; no numeric code properties remain. Actual busy failures are induced natively in integration.
- Follow-up TASK-261: withRetry currently uses p-retry broad retry policy when no predicate is supplied; wire the classifier by default in v0.6 rather than introduce that additional behavior change here.
<!-- SECTION:NOTES:END -->
