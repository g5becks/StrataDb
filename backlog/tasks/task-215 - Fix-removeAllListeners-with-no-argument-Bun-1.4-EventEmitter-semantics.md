---
id: TASK-215
title: Fix removeAllListeners() with no argument (Bun 1.4 EventEmitter semantics)
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T12:45:00Z'
labels:
  - api
milestone: m-0
dependencies: []
references:
  - src/sqlite-collection.ts
  - test/unit/collection-events.test.ts
documentation:
  - stratadb-audit.md
priority: high
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
`collection.removeAllListeners()` with no argument removes nothing on Bun >= 1.4. The implementation forwards `undefined` explicitly (`this._emitter.removeAllListeners(event)` in src/sqlite-collection.ts ~2184), and Node-compatible EventEmitter treats an explicit `undefined` as an event name. This causes the 2 failing tests in test/unit/collection-events.test.ts. Verified: the tests pass on Bun 1.3.6 and fail on 1.4.4. Audit refs: A18, 1B-B1.

## Implementation
1. In `removeAllListeners(event?)`: if `event === undefined`, call `this._emitter.removeAllListeners()` with no args; otherwise pass the event.
2. Search src/ for other EventEmitter calls that forward optional args and fix them the same way.
3. Add a regression test: register listeners on 2 events, call `removeAllListeners()`, and assert `listenerCount` is 0 for both.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 collection.removeAllListeners() with no argument removes listeners for every event (new regression test)
- [x] #2 The 2 previously failing tests in test/unit/collection-events.test.ts pass on Bun 1.4.4
- [x] #3 bun test reports 0 failures
- [x] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a two-event listener-count regression and reproduce A18.
2. Omit the emitter argument when no event is supplied; review related calls.
3. Update Unreleased changelog and run tests, typecheck, lint, build, and type tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Fixed removeAllListeners() without an event by calling EventEmitter with no arguments. Named-event removal and collection chaining are preserved. Other emitter calls do not forward optional arguments.
- Added an A18 regression checking listener counts across insert/update events. Before the fix the new test and the two existing cases failed (95 pass/3 fail); after the fix the full suite passes (713 pass/3 skip/0 fail).
- Verification: bun test; bun run typecheck; bun run lint; bun run build; bun run test:types all pass on Bun 1.4.4. CHANGELOG Unreleased documents the fix.
- Decisions: use the Node-compatible zero-argument call; no test.failing or skipped tests added.
<!-- SECTION:NOTES:END -->
