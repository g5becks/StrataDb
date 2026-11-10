---
id: TASK-249
title: 'Feature: atomic update operators ($set, $unset, $inc, $push, $pull)'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-10T01:20:00Z'
labels:
  - api
milestone: m-2
dependencies:
  - TASK-242
documentation:
  - stratadb-audit.md
priority: medium
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
updateOne only merges, so atomic counters and array appends need read-modify-write. Audit ref: A22.

## Implementation
1. Support `$set`, `$unset`, `$inc`, `$push`, `$pull` in update documents (mutually exclusive with plain merge objects), translated to `jsonb_set`/`jsonb_remove`/`jsonb_insert` expressions in a single UPDATE statement.
2. Validate paths through the FieldResolver.
3. Concurrency test: 100 concurrent `$inc: { n: 1 }` → n === 100.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each operator is translated to a single UPDATE statement (test asserts SQL shape or statement count)
- [x] #2 100 concurrent $inc updates produce exactly +100
- [x] #3 Mixing operators with plain fields in one update rejects with QueryError
- [ ] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add regression-first real SQLite coverage for each update operator, SQL statement shape/count, 100-way Promise.all increments, mixed/invalid paths, batch validation, upserts and event/rollback behavior.
2. Add typed operator updates, validate disjoint safe paths and operands, compute validation candidates, and compile operators into one JSONB UPDATE statement per operation within the existing transaction boundary.
3. Preserve merge updates, metadata/timestamps/events and validation atomicity; document exact array/equality semantics and run all host gates plus local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Added typed AtomicUpdate/DocumentUpdate unions for set/unset/inc/push/pull across updateOne, findOneAndUpdate, updateMany and event payloads. Operator paths and values are checked, immutable metadata cannot be targeted, and operator/plain forms cannot mix. Validation rejects unknown/malformed operators, overlapping paths, invalid identifiers, non-finite increments and incompatible array/numeric targets. Own-property traversal prevents prototype pollution.
- Existing immediate/savepoint boundaries prepare and validate candidates before writes. Operator single/batch operations compile to exactly one real JSONB UPDATE using bound paths/operands and jsonb_set/remove/insert/group_array. Batch RETURNING IDs retain trigger-aware counts/events. Plain deep merges remain available; dotted scalar equality filters now seed nested upsert documents, avoiding repeated nonmatching upserts. Metadata is stripped from JSON bodies and retained in columns.
- Decisions: push appends one JSON value; pull removes every structurally equal JSON value, ignoring object key order but preserving array order and scalar JSON types. SQL json_tree set comparisons implement the same equality as validation candidates. Missing inc/push fields initialize to zero/empty arrays; pulling missing fields is a no-op. Null/nonmatching targets and non-object traversal reject. unset accepts true, 1 or empty string.
- Regression-first: all six initial real SQLite cases failed before implementation. Final nine cases pass, including transparent native prepare instrumentation proving one UPDATE per operator/batch, 100-way Promise.all increments yielding every count 1..100, rollback/event suppression, all-or-nothing validation, upserts/return modes, all five injected identifier paths, structural pull and prototype safety. A further dotted-filter upsert regression inserted 10 rows before the seed fix; now 10 concurrent calls update one row to count 10. Added compile-time operand/path/metadata/mixed-form assertions.
- Breaking change: DocumentUpdate and update-event payloads are operator/merge unions with immutable metadata; consumers inspecting event.update should narrow its form. Documented migration, exact array semantics and storage invariants in CHANGELOG/document/event guides.
- Host gate PASS: 986 pass, 1 existing projection skip, 0 fail; TS 7.0.2 typecheck; lint; build; type tests; consumer TS 6/7 CRUD; source TS 5.9.3/6.0.3. Local CI pending committed SHA.
- Follow-up TASK-265 records the independently reproduced pre-existing updateOne retry:false forwarding defect (two attempts under inherited retries); TASK-260 now depends on it. No retry behavior was changed here.
<!-- SECTION:NOTES:END -->
