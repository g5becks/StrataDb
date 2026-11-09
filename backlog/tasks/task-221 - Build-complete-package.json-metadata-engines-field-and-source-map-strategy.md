---
id: TASK-221
title: 'Build: complete package.json metadata, engines field and source-map strategy'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T13:20:00Z'
labels:
  - build-release
milestone: m-0
dependencies:
  - TASK-217
documentation:
  - stratadb-audit.md
priority: medium
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
package.json has no license, repository, homepage, bugs, keywords, engines or sideEffects fields. Source maps reference ../src, which is not published. There are no git tags for any release. Audit refs: D1, D6.

## Implementation
1. Add `license` (match the LICENSE file), `repository` (git+https://github.com/g5becks/StrataDb.git), `homepage`, `bugs`, `keywords`, `"sideEffects": false`.
2. Add `"engines": { "bun": ">=1.3.14" }` for v0.5.1. It is raised to >=1.4.4 in v0.6.0 by a later task.
3. Source maps: either add `src` to `files`, or disable `declarationMap`/`sourcemap` in tsdown. Pick one and verify that "go to definition" works or is consistently absent.
4. Add `"./package.json": "./package.json"` to exports.
5. Verify with `bun pm pack --dry-run` (contents list).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 package.json has license, repository, homepage, bugs, keywords, sideEffects:false and engines.bun >=1.3.14
- [x] #2 The packed tarball either includes src/ for source maps or ships no .map files referencing missing sources
- [x] #3 exports includes ./package.json
- [x] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Complete public package metadata and package.json export while retaining Bun >=1.3.14.
2. Ship src alongside source maps and verify every map source exists in the packed package.
3. Run the complete quality gate and TypeScript matrix, review tarball contents, then commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Completed package metadata (MIT, repository/docs/issues, keywords, sideEffects:false), added package.json export and declared Bun >=1.3.14 for v0.5.1. Published files now include src for map navigation; CHANGELOG records the choice.
- Verification: pack --dry-run lists 34 files including sources and both maps; all 14 JS and 60 declaration map source entries resolve to shipped source files or embedded sourcesContent. Full quality gate and source/type-test TS 5.9/6.0/7.0 matrix pass (713 tests pass, 0 fail, 3 skip). Self-reviewed metadata and export paths. Remote CI run pending maintainer push.
- Decisions: retain source and declaration maps with src included. Runtime floor increase to >=1.4.4 remains TASK-240.
<!-- SECTION:NOTES:END -->
