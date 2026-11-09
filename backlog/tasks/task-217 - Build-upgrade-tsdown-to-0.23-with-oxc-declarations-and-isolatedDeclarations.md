---
id: TASK-217
title: 'Build: upgrade tsdown to 0.23 with oxc declarations and isolatedDeclarations'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - deps
  - build-release
milestone: m-0
dependencies:
  - TASK-216
references:
  - tsdown.config.ts
  - src/deep-merge.ts
documentation:
  - stratadb-audit.md
priority: high
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
tsdown 0.16.6 crashes on TypeScript 7 (no classic compiler API). tsdown 0.23.7 (rolldown-plugin-dts 0.30) supports TS 7, and its `oxc` declaration generator does not depend on the TS version. The tsgo generator is deprecated on TS 7.0. The upgrade also inlines type-fest types (fixes audit D1). Building with platform "neutral" changes output names to .js/.d.ts, so either use `fixedExtension: true` or update package.json fields. Audit refs: D1, D4, D5, 1A.

## Implementation
1. Upgrade tsdown to ^0.23.7.
2. tsdown.config.ts:
   - `dts: { generator: "oxc" }`;
   - replace the deprecated `external` with `deps: { neverBundle: ["bun:sqlite"] }`;
   - set `platform: "neutral"` (the library is Bun-only) and a modern target;
   - keep output names (`fixedExtension: true`) so `dist/index.mjs` and `dist/index.d.mts` stay unchanged.
3. tsconfig.json: enable `"isolatedDeclarations": true`, and add an explicit type annotation to `deepMerge` in src/deep-merge.ts (~line 70); it is the only TS9010 error.
4. Decide on `type-fest`: keep it inlined in the .d.ts (default) or move it to dependencies. Document the choice in CHANGELOG.
5. Verify that `bun run build` emits no warnings and dist/index.d.mts has no `from "type-fest"` import (if inlining).

## Out of scope
Switching the dev TypeScript version (next task).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 tsdown is ^0.23.x and bun run build completes with no deprecation warnings
- [ ] #2 dist/ still contains index.mjs and index.d.mts (package.json main/types/exports unchanged)
- [ ] #3 isolatedDeclarations is enabled and tsc reports 0 errors
- [ ] #4 dist/index.d.mts does not import from type-fest, or type-fest is listed in dependencies (choice recorded in CHANGELOG)
- [ ] #5 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
<!-- AC:END -->
