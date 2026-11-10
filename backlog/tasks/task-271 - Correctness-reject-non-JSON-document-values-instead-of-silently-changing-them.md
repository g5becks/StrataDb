---
id: TASK-271
title: 'Correctness: reject non-JSON document values instead of silently changing them'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-10T16:03:00Z'
updated_date: '2026-11-10T16:10:00Z'
labels:
  - correctness
  - breaking
milestone: m-3
dependencies: []
priority: high
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
`serializeJSON` (src/json-serialization.ts) only catches what `JSON.stringify` throws on. Other non-JSON values are silently changed. Measured on main (2026-11-10), `insertOne({ v })` stores:
- `Map` and `Set` become `{}`;
- `NaN`, `Infinity` and `-Infinity` become `null`;
- functions and symbols are dropped from objects;
- `undefined` inside arrays becomes `null`;
- `Date` becomes an ISO string, so it reads back as `string` while `T` still says `Date`;
- `BigInt` is rejected, but with the misleading message "circular references are unsupported".

This is silent data loss in a database.

## Implementation
1. Add a regression test per case to `test/regression/` before the fix.
2. Replace `serializeJSON` with a validating serializer. It walks the value once, iteratively or with a depth guard, and rejects anything that isn't JSON-safe, with `ValidationError` naming the offending path (for example `tags[2]`, `meta.created`) and the value's type. Plain objects only: reject class instances other than plain `Object` and arrays, unless the class has a `toJSON` method. Keep detecting circular references, now with the path.
3. Dates: pick one policy and document it in the README semantics page and the CHANGELOG. Either reject `Date` with a message that suggests ISO strings or epoch numbers, or accept it and make the TypeScript types say it reads back as `string`. Rejecting is preferred because types and runtime then agree. Record the decision in the task notes.
4. Keep `undefined` object properties dropped (standard JSON, documented). Reject `undefined` array elements.
5. Benchmark `insertMany` before and after with `bench/`. The validation must not slow `bench:batch` by more than 10%.

## Out of scope
BigInt storage. It stays unsupported, but with a clear error.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Map, Set, NaN, Infinity, -Infinity, BigInt, functions, symbols, undefined array elements and non-plain class instances (without toJSON) are rejected with ValidationError naming the path and type
- [x] #2 Circular references are still rejected, and the error names the path
- [x] #3 The Date policy is decided, implemented, typed consistently and documented (README semantics page and CHANGELOG Breaking changes)
- [x] #4 Regression tests cover every value type listed in the description, for insertOne, insertMany, replaceOne and update paths
- [x] #5 bench:batch insertMany throughput regresses by no more than 10%; numbers recorded in notes
- [x] #6 Quality gate and scripts/ci-local.sh pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add regressions for every unsupported value across insertOne, insertMany, replaceOne and updates; capture batch baseline.
2. Implement path-aware guarded JSON validation, rejecting Date and retaining undefined object omission; document migration.
3. Measure batch throughput, run required quality gates and local CI, and record verified criteria.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Outcome: path-aware JSON snapshots reject unsupported types, cycles and depths over 256 across insert, batch, replacement, plain and atomic updates. 97 new regressions; baseline red 0/97, green 97/97; full suite 1152 pass. Batch bodies serialize once before writes.
- Breaking change: Date rejects even with toJSON; migrate to ISO strings typed as string or epoch numbers typed as number. Undefined object properties remain omitted; undefined array elements reject. Other toJSON output is validated.
- Decisions: explicit Date rejection avoids returning strings behind Date types; snapshot validation prevents JSON.stringify from silently coercing values. Plain updates validate before deep merge.
- Verification: typecheck, lint, bun test, build, test:types, test:consumer, TS 5.9.3 and 6.0.3 source checks passed. Verified with scripts/ci-local.sh (387a2c7, PASS); GitHub Actions unavailable (billing lock).
- Benchmarks: Bun 1.4.4 / Apple M5, bench:batch insertMany 10 docs 119.56 -> 120.45 us (throughput -0.74%); 100 docs 280.00 -> 282.02 us (-0.72%); implicit batch 277.97 -> 282.18 us (-1.49%). Within 10% budget.
<!-- SECTION:NOTES:END -->
