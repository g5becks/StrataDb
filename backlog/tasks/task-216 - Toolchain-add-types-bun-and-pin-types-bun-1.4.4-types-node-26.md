---
id: TASK-216
title: 'Toolchain: add types:[bun] and pin @types/bun 1.4.4 + @types/node ^26'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - deps
milestone: m-0
dependencies:
  - TASK-214
documentation:
  - stratadb-audit.md
priority: high
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
TypeScript 6 and 7 default `compilerOptions.types` to `[]`, so bun-types is no longer loaded automatically. `tsc` 6.0.3 and 7.0.2 both report 56 errors, and 0 with `--types bun`. `@types/bun` is pinned to `latest` (lockfile 1.3.2). With TS 7 and `skipLibCheck: false`, bun-types 1.4.4 also needs `@types/node` >= 26 (the stale transitive 24.10.1 fails on KeyObject/TLSSocket). Audit refs: D2, D4, 1A.

## Implementation
1. tsconfig.json: add `"types": ["bun"]`.
2. package.json devDependencies: `@types/bun` pinned to `1.4.4` (exact), add `@types/node` `^26`.
3. `bun install`, then commit bun.lock.
4. Verify locally: `bunx -p typescript@6.0.3 tsc --noEmit` and `bunx -p typescript@7.0.2 tsc --noEmit` both report 0 errors.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 tsconfig.json contains "types": ["bun"]
- [ ] #2 package.json pins @types/bun to an exact version (1.4.4) and declares @types/node ^26; bun.lock updated
- [ ] #3 tsc --noEmit reports 0 errors with TypeScript 5.9.x, 6.0.x and 7.0.x
- [ ] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
<!-- AC:END -->
