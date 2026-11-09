---
id: TASK-227
title: 'Testing: encode audit Appendix A repros as test.failing regression suite'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T17:50:00Z'
labels:
  - testing
milestone: m-1
dependencies:
  - TASK-226
documentation:
  - stratadb-audit.md
priority: high
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Every v0.6.0 fix must be self-validating. Encode the audit's Appendix A repros as tests first, marked `test.failing` (Bun) so CI stays green. Each fix task flips its cases to plain `test`. Audit refs: Appendix A, Q3.

## Implementation
1. Create `test/regression/audit-2026-11.test.ts` (split per area if large) with one `test.failing(...)` per repro, named with its audit id, e.g. "A1 injection via filter key returns no rows".
   - A1: filter-key injection; `$index` injection; `limit` injection.
   - A2: `deleteMany({ role: { $eqq: "admin" } })` must throw and delete 0 rows.
   - A3: concurrent conditional updateOne: exactly one winner; concurrent updates of different fields: no lost update.
   - A4: deleteMany/updateMany inside db.execute(); an outside write during a pending execute() survives its rollback; no events for rolled-back writes.
   - A5: async methods never throw synchronously (retries off).
   - A6: a throwing listener does not fail a committed write.
   - A8: compoundIndex creates an index; a unique compound rejects duplicates.
   - A9: timestamps(false) omits createdAt/updatedAt.
   - A10: reopening with a new indexed field can query it.
   - A11: null equality and $ne semantics.
   - A12: $elemMatch on object arrays.
   - A13: $like case, wildcard escaping, search caseSensitive.
   - A14: skip without limit.
   - A15: unknown cursor id errors.
   - A16: collection names "order" and "user-data".
   - A17: DeleteEvent carries _id; deleteMany emits ids.
2. Each test asserts the **correct** behavior described in the audit, so it fails today.
3. Add a README note in test/regression explaining the flip-to-`test` convention.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 test/regression/ contains one test.failing case per audit repro A1-A17 listed in the description, each named with its audit id
- [x] #2 Every case asserts the correct (post-fix) behavior and currently fails; bun test is green because they are marked test.failing
- [x] #3 test/regression/README.md documents that fix tasks must convert their cases from test.failing to test
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Encode each listed Appendix A repro with exact post-fix assertions against real SQLite, named by audit ID and owning task.
2. Inspect expected failure output and document the conversion convention.
3. Run the full quality gate and compiler matrix; record only verified criteria.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Encoded 30 exact regression cases across A1-A6 and A8-A17, named with owning task IDs. A7/A18 already have passing v0.5.1 coverage.
- Inspected all 30 failures with test.failing temporarily converted to test: injection accepted/raw LIMIT parser error; destructive typo; two CAS winners/lost a; nested BEGIN errors/outside rollback/event leak; synchronous unique error; listener boom; absent compound index/duplicate accepted; timestamp keys; missing generated column; null omissions; elemMatch syntax; LIKE/search overmatching; OFFSET syntax; unknown cursor accepted; unquoted names; missing event ids. Restored expected failures.
- Breaking change: none. Decisions: null equality will include missing fields; separate assertions cover non-null $ne. Deferred promises give deterministic transaction interleaving without sleeps or mocks.
- Verification: typecheck (TS 7.0.2), lint (85 files), bun test (763 pass, 3 existing skips, 0 fail), build, test:types, packed consumer TS 6.0.3/7.0.2 and CRUD, source tsc 5.9.3/6.0.3 all PASS.
- Follow-ups: owning tasks convert their cases to normal tests; no new follow-up required.
<!-- SECTION:NOTES:END -->
