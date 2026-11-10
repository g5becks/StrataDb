---
id: TASK-254
title: >-
  Dependencies: upgrade deepmerge-ts 8, p-retry 9, standard-schema 1.1; drop
  fast-safe-stringify
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-10T02:40:00Z'
labels:
  - deps
milestone: m-2
dependencies:
  - TASK-242
documentation:
  - stratadb-audit.md
priority: medium
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Runtime deps are behind: deepmerge-ts 7 → 8 (agentx already forces ^8 via overrides, an untested combination), p-retry 7 → 9, @standard-schema/spec 1.0 → 1.1. fast-safe-stringify is unnecessary for JSON documents. Audit ref: D3.

## Implementation
1. Upgrade deepmerge-ts to 8, or remove it if the atomic-writes task made it unused.
2. Upgrade p-retry to 9 (read its changelog; adapt `RetryContext` types) and @standard-schema/spec to 1.1.
3. Replace fast-safe-stringify with JSON.stringify, throwing ValidationError on circular input; add a test.
4. Run the consumer smoke test.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 bun outdated shows no outdated runtime dependency
- [x] #2 fast-safe-stringify is removed; circular documents reject with ValidationError (test)
- [x] #3 Consumer smoke test passes
- [x] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add circular insert, batch, merge and replacement regressions before replacing serialization.
2. Upgrade runtime dependencies to current majors, review retry behavior/context changes, replace fast-safe-stringify with JSON.stringify and typed validation failures.
3. Verify dependency freshness, callback/abort behavior, full host gates and local CI; document compatibility decisions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Outcome: upgraded deepmerge-ts8.0.2, p-retry9.0.0 and Standard Schema1.1.0; removed fast-safe-stringify. JSON serialization failures preserve their cause and reject with ValidationError. Batch serialization preflight prevents swallowed errors and partial writes.
- Breaking change: circular inputs reject rather than storing markers; p-retry callback order, abort precedence and RetryContext.retryDelay follow version9. Typed context fixture now verifies the new member.
- Regression-first: all five circular insert/batch/update/replace/updateMany cases failed before the fix because promises resolved; all now pass with exact row/event assertions. Added callback-order/retryDelay and abort-precedence regressions.
- Verification: full host gate PASS, 1043 tests pass/no skips/failures; TS5.9.3/6.0.3/7.0.2, lint, build, type tests, packed consumer TS6/7 and CRUD PASS. bun outdated lists only devDependencies (TASK-255).
- Decisions: retain deepmerge-ts for plain merge updates, including array replacement/undefined behavior; no unsafe entrypoint. RetryContext reexports current upstream type without adapter.
- Sources reviewed: https://github.com/sindresorhus/p-retry/releases/tag/v9.0.0 and v8.0.0; https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0.
- Follow-ups: none.

Verified with scripts/ci-local.sh (494fc428629334151a53756ce22d4b33962e0702, PASS); GitHub Actions unavailable (billing lock). macOS/Linux pinned/latest Bun1.4.4, TS5.9.3/6.0.3/7.0.2 and advisory7.1-beta all PASS.
<!-- SECTION:NOTES:END -->
