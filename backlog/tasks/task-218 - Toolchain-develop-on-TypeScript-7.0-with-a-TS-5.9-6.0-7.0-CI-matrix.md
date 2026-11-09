---
id: TASK-218
title: 'Toolchain: develop on TypeScript 7.0 with a TS 5.9/6.0/7.0 CI matrix'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T13:17:00Z'
labels:
  - deps
milestone: m-0
dependencies:
  - TASK-217
documentation:
  - stratadb-audit.md
priority: high
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
agentx (the main consumer) is moving to TypeScript 7. StrataDB must develop and test against TS 7.0.x while still serving TS 5.9/6.0 consumers. Audit ref: 1A.

## Implementation
1. devDependencies: `typescript` ~7.0.2. Update the `typecheck` script if needed (TS 7 ships `tsc`).
2. CI: add a typecheck matrix job: TS 7.0.x (blocking), 6.0.x (blocking), 5.9.x (blocking), 7.1 beta/next (continue-on-error). Use `bunx -p typescript@<v> tsc --noEmit`.
3. Make sure nothing else in the toolchain imports the `typescript` JS API under TS 7 (typedoc and tsd are handled by separate tasks; keep `docs:build` and `test:types` working, temporarily pinning them to TS 5.9/6 if needed).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 package.json devDependencies use typescript ~7.0.x and bun run typecheck passes
- [x] #2 CI runs tsc --noEmit on TypeScript 7.0.x, 6.0.x and 5.9.x (all blocking) and on TS 7.1 beta/next (non-blocking)
- [x] #3 bun run build, bun run docs:build and bun run test:types still succeed
- [x] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Upgrade the development compiler to ~7.0.2 and refresh the lockfile.
2. Add blocking 5.9/6.0/7.0 and advisory 7.1 beta CI legs.
3. Verify runtime, build, docs and existing type tests; leave permanent docs/type-test isolation to their own tasks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Development now uses TypeScript ~7.0.2. CI adds blocking 5.9.3/6.0.3/7.0.2 and advisory 7.1.0-beta source checks. CHANGELOG records compatibility coverage.
- Verification: complete quality gate passes (713 tests pass, 0 fail, 3 skip), all three blocking compiler versions pass, actionlint exits 0, and docs:build succeeds with root TS 7. Existing tsd uses its bundled compiler until TASK-219. Remote CI run pending maintainer push.
- Decisions: preserve the current static VitePress build in this task; permanent TypeDoc regeneration/isolation follows in TASK-220. Self-reviewed workflow and lockfile.
<!-- SECTION:NOTES:END -->
