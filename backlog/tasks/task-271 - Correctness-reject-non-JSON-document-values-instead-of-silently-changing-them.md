---
id: TASK-271
title: 'Correctness: reject non-JSON document values instead of silently changing them'
status: To Do
assignee: []
created_date: '2026-11-10T16:03:00Z'
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
- [ ] #1 Map, Set, NaN, Infinity, -Infinity, BigInt, functions, symbols, undefined array elements and non-plain class instances (without toJSON) are rejected with ValidationError naming the path and type
- [ ] #2 Circular references are still rejected, and the error names the path
- [ ] #3 The Date policy is decided, implemented, typed consistently and documented (README semantics page and CHANGELOG Breaking changes)
- [ ] #4 Regression tests cover every value type listed in the description, for insertOne, insertMany, replaceOne and update paths
- [ ] #5 bench:batch insertMany throughput regresses by no more than 10%; numbers recorded in notes
- [ ] #6 Quality gate and scripts/ci-local.sh pass
<!-- AC:END -->
