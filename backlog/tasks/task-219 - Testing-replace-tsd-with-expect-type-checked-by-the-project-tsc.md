---
id: TASK-219
title: 'Testing: replace tsd with expect-type checked by the project tsc'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
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
- [ ] #1 tsd is removed from package.json (devDependency and config field)
- [ ] #2 All assertions previously in test/type/*.test-d.ts exist as expect-type or @ts-expect-error assertions and pass
- [ ] #3 Type tests run without a prior build and run on every TypeScript version in the CI matrix
- [ ] #4 Deliberately breaking one assertion makes bun run test:types fail (verified once locally)
- [ ] #5 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
<!-- AC:END -->
