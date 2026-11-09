---
id: TASK-229
title: 'Safety: reject unknown query operators and malformed operator values'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T18:01:00Z'
labels:
  - api
milestone: m-1
dependencies:
  - TASK-228
documentation:
  - stratadb-audit.md
priority: high
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
**Data loss (Critical).** Unknown operators are silently ignored (`default: return null` in `translateSingleOperator`), so the condition disappears and the filter matches everything. Repro: `deleteMany({ role: { $eqq: "admin" } })` deleted every row. `InvalidQueryOperatorError` exists but is never thrown. Audit ref: A2.

## Implementation
1. Throw `InvalidQueryOperatorError` for any unrecognized `$`-prefixed key, at any nesting level (field operators, `$elemMatch`, `$index`, logical operators).
2. Validate operator value shapes: `$in`/`$nin`/`$all` take arrays; `$size` takes a non-negative integer; `$exists` takes a boolean; LIKE-family operators take strings.
3. Optional safety: `deleteMany({})` requires `{ all: true }` in options. Record the decision in CHANGELOG.
4. Flip regression case A2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every query method (find, findOne, count, updateMany, deleteMany, findOneAnd*) rejects an unknown $operator with InvalidQueryOperatorError
- [x] #2 Regression case A2 passes: deleteMany with $eqq throws and deletes 0 rows
- [x] #3 Malformed operator values (e.g. $in with a string) reject with QueryError (tests for each operator)
- [x] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change (Breaking changes section)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add regression cases for unknown operators at every nesting level/method and malformed shapes before implementation.
2. Validate the entire query before cache lookup and reject unknown operators without modifying data; export the error class.
3. Convert A2, document strict behavior while retaining explicit empty-filter bulk operations, run host gates and local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Validate the complete filter tree before cache lookup: reject unknown operators with exported InvalidQueryOperatorError, malformed values with QueryError. Validation covers logical branches, elemMatch fields/operators, index conditions, arrays, strings, booleans and sizes. A2 is a normal passing test.
- Breaking change: malformed or unknown query operators no longer disappear from filters. Explicit empty-filter bulk operations remain available; no all:true option added. Corrected an existing event test to supply the required count({}) filter; its assertion remains unchanged.
- Regression-first evidence: strict-operators suite initially had 31 failures and one existing rejection; now all 32 cases pass, including every filter method and cache-hit validation, with unchanged documents asserted after each rejection.
- Host gate PASS: TS 7.0.2 typecheck, lint 89 files, 817 pass/3 existing skips/0 fail, build, type tests, consumer TS 6/7 and CRUD, source TS 5.9.3/6.0.3. Local CI pending committed SHA. Follow-ups: none.

Verified with scripts/ci-local.sh (f7332ae045880ea6361e1114705d2eeb6cae927b, PASS); GitHub Actions unavailable (billing lock). macOS/Linux pinned/latest Bun 1.4.4 PASS; TS 5.9.3/6.0.3/7.0.2 source and type tests PASS; TS 7.1.0-beta advisory PASS. Logs at /Users/takinprofit/Dev/StrataDb-release/ci-local/f7332ae/logs.
<!-- SECTION:NOTES:END -->
