---
id: TASK-229
title: 'Safety: reject unknown query operators and malformed operator values'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
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
- [ ] #1 Every query method (find, findOne, count, updateMany, deleteMany, findOneAnd*) rejects an unknown $operator with InvalidQueryOperatorError
- [ ] #2 Regression case A2 passes: deleteMany with $eqq throws and deletes 0 rows
- [ ] #3 Malformed operator values (e.g. $in with a string) reject with QueryError (tests for each operator)
- [ ] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change (Breaking changes section)
<!-- AC:END -->
