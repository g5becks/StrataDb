---
id: TASK-255
title: 'Dependencies: upgrade Biome/ultracite, commitlint and remaining dev tooling'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
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
- [ ] #1 bun outdated shows no outdated devDependency except ones documented as intentionally pinned (with reason in notes)
- [ ] #2 bun run lint passes with zero warnings after the ultracite major upgrade
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
<!-- AC:END -->
