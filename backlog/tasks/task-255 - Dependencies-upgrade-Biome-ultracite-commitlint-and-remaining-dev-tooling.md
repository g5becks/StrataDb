---
id: TASK-255
title: 'Dependencies: upgrade Biome/ultracite, commitlint and remaining dev tooling'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-10T02:47:00Z'
labels:
  - deps
milestone: m-2
dependencies:
  - TASK-242
documentation:
  - stratadb-audit.md
priority: low
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Biome 2.3.6 → 2.6.x, ultracite 6.3.4 → 8.x (two majors), commitlint 20 → 21, plus typedoc-plugin-markdown, vitepress-carbon, arktype/zod/valibot (Standard Schema tests). Audit ref: D4.

## Implementation
Upgrade them one tool at a time, run `ultracite fix`, review the rule changes, and keep the lint output at zero. Move to TypeScript 7.1 when GA if available (re-evaluate the TypeDoc workspace and the tsgo d.ts generator then).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 bun outdated shows no outdated devDependency except ones documented as intentionally pinned (with reason in notes)
- [x] #2 bun run lint passes with zero warnings after the ultracite major upgrade
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Upgrade Biome, then Ultracite, reviewing config and fixes without weakening tests.
2. Upgrade commitlint, schema-test libraries and remaining dev/docs tools in stages; keep documented Bun-floor and TS6 TypeDoc pins.
3. Verify freshness, zero lint warnings, docs build, full host gate, actionlint where workflow changes require it and local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Outcome: Biome2.6.6, Ultracite8.1.1, commitlint21.2.4, ArkType2.2.9/Zod4.6.7/Valibot1.5.0, lefthook2.2.2, type-fest5.10.0 and VitePress1.6.4 installed and locked. Upgraded in stages with type/lint/validator checks; migrated preset path to ultracite/biome/core.
- Breaking change: none to the public API. Preserved alias and callback/method styles and meaningful object order. Automatic object-key sorting was reverted and disabled because it changes sort priority. Sequential await loops are deliberate for transaction ordering, interleaving assertions and benchmark protocols; class methods follow existing contracts. New false-positive runtime guards have narrow explained suppressions, and unused suppressions were removed. No assertions were removed or weakened.
- Verification: full host gate PASS (1043 tests, zero failures/skips), source TS5.9.3/6.0.3/7.0.2, lint zero warnings, build, type tests, packed consumer TS6/7+CRUD and actionlint PASS. docs:build PASS with nine unsuppressed TypeDoc warnings owned by TASK-264 and the existing VitePress chunk advisory. Generated API updated.
- Freshness: root bun outdated empty; docs only TS6.0.3 intentionally pinned because TypeDoc0.28 uses the TS6 workspace. npm view typescript dist-tags confirms stable7.0.2 and beta7.1; no GA7.1 upgrade. Bun types remain pinned1.4.4 to verify the supported runtime floor.
- Decisions: leave ci.yml unchanged, so no ci-local mirror edits needed. Backlog and Serena metadata are excluded from formatting; YAML formatting is disabled to avoid unrelated workflow churn.
- Follow-ups: existing TASK-264 resolves all public-type documentation warnings.
<!-- SECTION:NOTES:END -->
