---
id: TASK-233
title: 'Correctness: isolate event listener errors from write operations'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - api
milestone: m-1
dependencies:
  - TASK-232
documentation:
  - stratadb-audit.md
priority: medium
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
A throwing event listener makes a write whose row is already committed report failure, so retry wrappers may duplicate it. Audit ref: A6.

## Implementation
1. In `emitEvent`, invoke listeners so that their exceptions never propagate into the write operation. Catch them and route them to an `'error'` collection event or a `Strata` option `onListenerError(err, event)`; default to `console.error` with event context.
2. Define and document the delivery guarantees: after commit (per the transactions task), synchronous, in registration order, at-most-once.
3. Flip regression case A6.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Regression case A6 passes: a throwing insert listener does not make insertOne reject; the row is committed
- [ ] #2 Listener errors are delivered to onListenerError or an error event (test for each path)
- [ ] #3 Event delivery guarantees are documented in docs/guide (events page)
- [ ] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
