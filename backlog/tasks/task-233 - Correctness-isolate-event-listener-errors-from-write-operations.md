---
id: TASK-233
title: 'Correctness: isolate event listener errors from write operations'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T18:20:00Z'
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
- [x] #1 Regression case A6 passes: a throwing insert listener does not make insertOne reject; the row is committed
- [x] #2 Listener errors are delivered to onListenerError or an error event (test for each path)
- [x] #3 Event delivery guarantees are documented in docs/guide (events page)
- [x] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add failing listener-isolation coverage for registration order, once, retry duplication, error observers, async rejections and committed transaction flushes.
2. Dispatch raw listener snapshots individually and isolate failures, routing to error listeners or console.error without recursive failure.
3. Convert A6, strengthen the existing listener test, document delivery guarantees and run all quality gates plus local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Dispatch listener snapshots individually in registration order, including native once wrappers. Synchronous exceptions and async rejections are isolated; later listeners still run. Failures route to collection error observers; unobserved failures and failing error observers log without recursion. Removed the emit typing suppression by using the typed dispatch method.
- Decision: use the existing error event plus console fallback instead of adding a new onListenerError option. Both reporting paths, recursive-error protection, async failures, once behavior, transaction flushing and retry non-duplication are tested. Delivery is synchronous after outer commit, at most once per registration/event; async listener completion is not awaited.
- A6 is a normal passing test. Strengthened the original listener test to require successful insertion and delivery to the second listener. Regression-first new suite: 5 failures before, 5 passes after.
- Breaking change: none; enforces documented listener guarantees. Updated docs/guide/events.md and CHANGELOG. Host gate PASS: TS 7.0.2 typecheck, lint 94 files, 854 pass/3 existing skips/0 fail, build, type tests, consumer TS 6/7 and CRUD, source TS 5.9.3/6.0.3. Local CI pending committed SHA.

Verified with scripts/ci-local.sh (1a07cabc36e70ed51f3afee908b7739c14c6475d, PASS); GitHub Actions unavailable (billing lock). macOS/Linux pinned/latest Bun 1.4.4 PASS; TS 5.9.3/6.0.3/7.0.2 source/type tests PASS; TS 7.1.0-beta advisory PASS. Logs: /Users/takinprofit/Dev/StrataDb-release/ci-local/1a07cab/logs. Self-review complete; no follow-up required.
<!-- SECTION:NOTES:END -->
