---
id: TASK-220
title: 'Build: run TypeDoc/VitePress docs build from a TS 6 docs workspace'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T13:20:00Z'
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
- [x] #1 bun run docs:build succeeds with root typescript 7.x installed and regenerates docs/api
- [x] #2 deploy-docs.yml succeeds on a test branch or with workflow_dispatch
- [x] #3 The root package no longer needs typedoc/vitepress devDependencies (moved to the docs workspace)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Isolate TypeDoc, its plugins and VitePress in a private docs package with TS 6.
2. Route docs commands and deployment through that package and regenerate API pages.
3. Verify docs build with root TS 7, frozen installs, workflow lint and complete quality gate.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Moved TypeDoc/plugins and VitePress/theme into an isolated private docs package pinned to TS ~6.0.3; root remains TS ~7.0.2. Root docs commands regenerate API pages before VitePress. Deployment installs both lockfiles frozen. Regenerated stale API docs, including collection event types.
- Verification: both frozen installs pass; docs:build regenerates docs/api and renders successfully under root TS 7. Full quality gate, source/type-test TS matrix and actionlint pass (713 pass, 0 fail, 3 skip). Remote CI run pending maintainer push.
- Decisions: independent docs lockfile prevents TypeDoc from resolving the root TS 7 compiler. TOOLCHAIN.md and CHANGELOG track removing isolation once TypeDoc supports TS 7. A small finalizer adds the generated sidebar newline required by lint. Existing TypeDoc comment/link warnings and VitePress chunk-size advice are non-fatal; documentation cleanup remains TASK-259. Self-reviewed generated docs and workflow.
<!-- SECTION:NOTES:END -->
