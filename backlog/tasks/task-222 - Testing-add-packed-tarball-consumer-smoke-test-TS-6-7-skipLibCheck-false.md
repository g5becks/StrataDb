---
id: TASK-222
title: 'Testing: add packed-tarball consumer smoke test (TS 6/7, skipLibCheck false)'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
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
- [ ] #1 A CI job packs the library, installs it into a fixture with production deps only, and typechecks the fixture on TS 7.0 and 6.0 with skipLibCheck false
- [ ] #2 The fixture executes CRUD against :memory: under Bun and exits 0
- [ ] #3 Removing a runtime dependency from package.json makes the smoke job fail (verified once locally)
<!-- AC:END -->
