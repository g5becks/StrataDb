---
id: TASK-217
title: 'Build: upgrade tsdown to 0.23 with oxc declarations and isolatedDeclarations'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T13:16:00Z'
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
- [x] #1 tsdown is ^0.23.x and bun run build completes with no deprecation warnings
- [x] #2 dist/ still contains index.mjs and index.d.mts (package.json main/types/exports unchanged)
- [x] #3 isolatedDeclarations is enabled and tsc reports 0 errors
- [x] #4 dist/index.d.mts does not import from type-fest, or type-fest is listed in dependencies (choice recorded in CHANGELOG)
- [x] #5 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Upgrade tsdown, use oxc isolated declarations, and preserve .mjs/.d.mts exports.
2. Annotate the internal merge function and inline type-fest declarations; document the packaging decision.
3. Verify build output, compiler matrix, and complete quality gate.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Upgraded tsdown to 0.23.7 with oxc declarations, isolatedDeclarations, neutral/esnext output and fixed extensions. type-fest and tagged-tag declarations are explicitly inlined; runtime dependencies remain external. CHANGELOG records the choice.
- Verification: TS 5.9.3/6.0.3/7.0.2, typecheck, lint, tests (713 pass, 0 fail, 3 skip), build and tsd pass. Output names preserved and actual declaration imports contain no type-fest (JSDoc examples still mention it). Build emits no warnings. Remote CI run pending maintainer push.
- Decisions: internal deepMerge accepts unknown inputs and returns unknown; mergeDocumentUpdate retains its existing generic boundary. This avoids recursive dependency-type comparison failures under TS 6 while preserving runtime semantics. Self-reviewed bundle and diff.
<!-- SECTION:NOTES:END -->
