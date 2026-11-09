---
id: TASK-227
title: 'Testing: encode audit Appendix A repros as test.failing regression suite'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
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
- [ ] #1 test/regression/ contains one test.failing case per audit repro A1-A17 listed in the description, each named with its audit id
- [ ] #2 Every case asserts the correct (post-fix) behavior and currently fails; bun test is green because they are marked test.failing
- [ ] #3 test/regression/README.md documents that fix tasks must convert their cases from test.failing to test
<!-- AC:END -->
