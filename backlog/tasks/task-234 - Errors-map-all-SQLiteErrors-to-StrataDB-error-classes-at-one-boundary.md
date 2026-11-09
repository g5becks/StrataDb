---
id: TASK-234
title: 'Errors: map all SQLiteErrors to StrataDB error classes at one boundary'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T18:26:00Z'
labels:
  - api
milestone: m-1
dependencies:
  - TASK-223
  - TASK-230
references:
  - src/errors.ts
documentation:
  - stratadb-audit.md
priority: medium
type: enhancement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
7 of 12 exported error classes are never thrown. Raw Bun SQLiteError (syntax, missing column, lock) leaks to callers. errors.ts has 63.6% coverage. Bun < 1.4 leaves `code` undefined for generic errors, so mapping must use errno. Audit refs: A19, 1B-B1.

## Implementation
1. Add `wrapSqliteError(err, ctx: { sql?, collection?, operation? })`, mapping by `errno & 0xff`:
   - BUSY/LOCKED → ConnectionError or TransactionError (retryable);
   - CONSTRAINT_UNIQUE/PRIMARYKEY → UniqueConstraintError;
   - other CONSTRAINT_* → ConstraintError;
   - ERROR → QueryError.
   Attach errno, code and context.
2. Wrap at every place statements run (prepare/run/all/get/exec).
3. For each exported class, either throw it in a real path or mark it `@deprecated` (do not remove in 0.6.0).
4. Ensure the retry classifier from the earlier retry task still recognizes wrapped errors.
5. Tests: one per mapping, plus errors.ts coverage >= 90%.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No raw bun:sqlite SQLiteError escapes a public API call (tests for syntax error, unique violation, lock, missing table)
- [x] #2 Every exported error class is either thrown by a tested code path or marked @deprecated
- [x] #3 Wrapped lock errors are still retried (retry integration test passes)
- [x] #4 src/errors.ts line coverage >= 90%
- [ ] #5 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #6 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add real SQLite tests for syntax/missing-table, unique/constraint, lock retry, constructor failures and typed error context; inspect pre-fix output.
2. Add one errno-based error mapper and a statement/exec boundary, preserve causes and context, and route public collection/transaction/database paths through it.
3. Deprecate reserved unused classes without removal, cover error metadata/constructors to >=90% line coverage, update wrapped-lock expectations and docs.
4. Run all quality gates, coverage and local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Central errno mapper and statement/exec boundary now cover library collection SQL, transaction control, database open/version/close, and errors crossing execute callbacks. Native statements retain binding and lifecycle behavior through a proxy; no parameter values are logged or attached to context.
- Mappings: BUSY/LOCKED/CANTOPEN -> ConnectionError; UNIQUE/PRIMARYKEY -> UniqueConstraintError; other constraints -> ConstraintError; SQLITE_ERROR -> QueryError; remaining SQLite failures -> DatabaseError. Preserve errno, native code name, library code, cause and operation/collection/SQL context. Removed duplicate message-based mappings; insertOne preserves the unique value property. Direct sqliteDb remains the native escape hatch.
- Reserved TypeMismatchError and TransactionAbortedError are deprecated, retained and exported for compatibility. All other classes have real tested paths; constructor metadata coverage is 100% lines/functions for src/errors.ts.
- Regression-first mapping suite: 5 failures before, 5 passes after. Real SQLITE_BUSY integration now requires wrapped ConnectionError and native SQLiteError cause, and recovers after real lock release.
- Breaking change: none; applies the documented typed-error taxonomy. Host gate PASS: typecheck TS 7.0.2; lint 97 files; coverage 860 pass/3 existing skips/0 fail; errors.ts 100% lines/functions; build; type tests; consumer TS 6/7 and CRUD; source TS 5.9.3/6.0.3. Local CI pending committed SHA.
<!-- SECTION:NOTES:END -->
