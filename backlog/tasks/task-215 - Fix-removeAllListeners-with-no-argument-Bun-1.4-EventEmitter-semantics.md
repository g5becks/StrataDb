---
id: TASK-215
title: Fix removeAllListeners() with no argument (Bun 1.4 EventEmitter semantics)
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
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
- [ ] #1 collection.removeAllListeners() with no argument removes listeners for every event (new regression test)
- [ ] #2 The 2 previously failing tests in test/unit/collection-events.test.ts pass on Bun 1.4.4
- [ ] #3 bun test reports 0 failures
- [ ] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
