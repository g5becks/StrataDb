---
id: TASK-222
title: 'Testing: add packed-tarball consumer smoke test (TS 6/7, skipLibCheck false)'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T13:21:00Z'
labels:
  - testing
  - build-release
milestone: m-0
dependencies:
  - TASK-221
  - TASK-218
documentation:
  - stratadb-audit.md
priority: medium
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Publishing defects (types depending on devDependencies, missing files, TS-version incompatibilities) are invisible to in-repo tests. Audit refs: Q8, D1, 1A.

## Implementation
1. Add `scripts/smoke-consumer.ts` (or a CI job) that:
   1. runs `bun pm pack` into a temp dir;
   2. creates a temp fixture project with only production deps installed from the tarball (plus @types/bun, @types/node);
   3. writes a fixture that imports `Strata`, `createSchema`, `Document`, runs insert/find/update/delete on `:memory:`, and includes a `// @ts-expect-error` asserting a wrong field type is rejected;
   4. typechecks it with TypeScript 7.0.x and 6.0.x under `skipLibCheck: false`;
   5. runs it with Bun.
2. Run it in CI after build.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A CI job packs the library, installs it into a fixture with production deps only, and typechecks the fixture on TS 7.0 and 6.0 with skipLibCheck false
- [x] #2 The fixture executes CRUD against :memory: under Bun and exits 0
- [x] #3 Removing a runtime dependency from package.json makes the smoke job fail (verified once locally)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create an isolated production-only tarball consumer with strict TS 6/7 checks and CRUD assertions.
2. Run it after CI build and expose a local smoke command.
3. Prove a missing runtime dependency fails, then verify the complete quality gate and compiler matrix.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Added test:consumer: packs the built library into a temporary isolated fixture, installs only production dependencies plus Bun/Node types, checks published types on TS 6.0.3/7.0.2 with skipLibCheck:false, and executes asserted CRUD, projection and package.json-export checks. The fixture includes a wrong-field-type compiler assertion. CI runs it after build on each OS/runtime leg.
- Verification: consumer typechecks and CRUD pass; temporarily removing p-retry from package metadata makes the smoke fail with TS2307 for missing p-retry, then metadata is restored. Complete quality gate and source/type-test compiler matrix pass (713 pass, 0 fail, 3 skip); actionlint exits 0. Remote CI run pending maintainer push.
- Decisions: fixtures install outside the repository so development dependencies cannot mask packaging defects; temporary artifacts are removed even on failure. Self-reviewed script and mutation evidence.
<!-- SECTION:NOTES:END -->
