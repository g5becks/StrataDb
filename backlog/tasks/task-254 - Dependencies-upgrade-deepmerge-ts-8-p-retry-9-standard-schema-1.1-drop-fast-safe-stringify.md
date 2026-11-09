---
id: TASK-254
title: >-
  Dependencies: upgrade deepmerge-ts 8, p-retry 9, standard-schema 1.1; drop
  fast-safe-stringify
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
priority: medium
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Runtime deps are behind: deepmerge-ts 7 → 8 (agentx already forces ^8 via overrides, an untested combination), p-retry 7 → 9, @standard-schema/spec 1.0 → 1.1. fast-safe-stringify is unnecessary for JSON documents. Audit ref: D3.

## Implementation
1. Upgrade deepmerge-ts to 8, or remove it if the atomic-writes task made it unused.
2. Upgrade p-retry to 9 (read its changelog; adapt `RetryContext` types) and @standard-schema/spec to 1.1.
3. Replace fast-safe-stringify with JSON.stringify, throwing ValidationError on circular input; add a test.
4. Run the consumer smoke test.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bun outdated shows no outdated runtime dependency
- [ ] #2 fast-safe-stringify is removed; circular documents reject with ValidationError (test)
- [ ] #3 Consumer smoke test passes
- [ ] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
