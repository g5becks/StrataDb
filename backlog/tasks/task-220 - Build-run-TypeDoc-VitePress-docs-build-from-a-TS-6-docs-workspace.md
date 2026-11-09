---
id: TASK-220
title: 'Build: run TypeDoc/VitePress docs build from a TS 6 docs workspace'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - build-release
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
TypeDoc 0.28.x (latest 0.28.20) supports TypeScript only up to 6.0 and crashes on TS 7 ("Cannot read properties of undefined (reading 'PropertyDeclaration')"). TypeDoc imports `typescript` by name, so installing an alias package next to TS 7 is not enough. Audit ref: 1A item 4.

## Implementation
1. Create a small docs workspace (e.g. `docs/package.json`) with its own `typescript@~6.0`, `typedoc`, `typedoc-plugin-markdown`, `typedoc-vitepress-theme`, `vitepress`.
2. Point `docs:build` and `docs:dev` at that workspace (TypeDoc runs from it, reading ../src).
3. Keep `deploy-docs.yml` working (install both workspaces).
4. Add a code comment and a tracking note (GitHub issue or CHANGELOG line) to fold it back once TypeDoc supports TS 7.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bun run docs:build succeeds with root typescript 7.x installed and regenerates docs/api
- [ ] #2 deploy-docs.yml succeeds on a test branch or with workflow_dispatch
- [ ] #3 The root package no longer needs typedoc/vitepress devDependencies (moved to the docs workspace)
<!-- AC:END -->
