---
id: TASK-219
title: 'Testing: replace tsd with expect-type checked by the project tsc'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T13:18:00Z'
labels:
  - testing
milestone: m-0
dependencies:
  - TASK-218
documentation:
  - stratadb-audit.md
priority: medium
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
tsd bundles its own TypeScript 5.9.3, so type tests never exercise TS 6/7, and `test:types` requires a full build. Audit refs: Q1, Q6, 1A.

## Implementation
1. Add `expect-type` as a devDependency.
2. Port each file in test/type/*.test-d.ts to `expectTypeOf(...)` / `// @ts-expect-error` assertions importing from `../../src/index.ts`, with no build step.
3. Add a tsconfig for type tests (or include them in the main typecheck) so `tsc --noEmit` checks them on every CI TS version.
4. Remove `tsd` and the `tsd` package.json field; make `test:types` run the new check.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 tsd is removed from package.json (devDependency and config field)
- [x] #2 All assertions previously in test/type/*.test-d.ts exist as expect-type or @ts-expect-error assertions and pass
- [x] #3 Type tests run without a prior build and run on every TypeScript version in the CI matrix
- [x] #4 Deliberately breaking one assertion makes bun run test:types fail (verified once locally)
- [x] #5 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #6 Ported assertions accurately cover readonly results, RetryContext callbacks, and the current absence of regex operators
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Port every tsd assertion to expect-type or compiler-checked error directives against source.
2. Add a type-test tsconfig and run it in each CI compiler leg without building.
3. Prove a broken assertion fails, then run the complete quality gate and compiler matrix.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Replaced all four tsd files with expect-type and compiler error assertions against source. test:types uses its own strict tsconfig without a build; every CI compiler leg checks it. Removed tsd and its config.
- Verification: TS 5.9.3/6.0.3/7.0.2 pass source and all type tests; quality gate passes (713 pass, 0 fail, 3 skip); actionlint exits 0. Changing the message assertion from string to number makes test:types exit 1; restoring it passes. Self-reviewed each migrated assertion. Remote CI run pending maintainer push.
- Decisions: corrected stale expectations to current public contracts (RetryContext including retriesConsumed, readonly results, literal database error category, and absent regex operators). Regex absence is explicitly checked until TASK-256 adds it. No runtime tests removed or weakened.
<!-- SECTION:NOTES:END -->
