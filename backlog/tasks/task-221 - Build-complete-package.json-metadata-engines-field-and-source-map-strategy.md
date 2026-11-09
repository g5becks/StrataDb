---
id: TASK-221
title: 'Build: complete package.json metadata, engines field and source-map strategy'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
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
- [ ] #1 package.json has license, repository, homepage, bugs, keywords, sideEffects:false and engines.bun >=1.3.14
- [ ] #2 The packed tarball either includes src/ for source maps or ships no .map files referencing missing sources
- [ ] #3 exports includes ./package.json
- [ ] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
<!-- AC:END -->
