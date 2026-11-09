---
id: TASK-234
title: 'Errors: map all SQLiteErrors to StrataDB error classes at one boundary'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
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
- [ ] #1 No raw bun:sqlite SQLiteError escapes a public API call (tests for syntax error, unique violation, lock, missing table)
- [ ] #2 Every exported error class is either thrown by a tested code path or marked @deprecated
- [ ] #3 Wrapped lock errors are still retried (retry integration test passes)
- [ ] #4 src/errors.ts line coverage >= 90%
- [ ] #5 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #6 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
