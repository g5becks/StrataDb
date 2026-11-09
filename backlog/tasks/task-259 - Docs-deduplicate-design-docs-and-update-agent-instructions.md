---
id: TASK-259
title: 'Docs: deduplicate design docs and update agent instructions'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - build-release
milestone: m-2
dependencies:
  - TASK-258
documentation:
  - stratadb-audit.md
priority: low
type: docs
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
DESIGN.md is duplicated (root 4,039 lines vs docs/DESIGN.md 4,047 lines, diverged). COLLECTION_EVENTS_DESIGN.md and a 658-line .github/copilot-instructions.md sit at the root. Agent instructions must match post-0.6 behavior. Audit refs: C5, C6, C7.

## Implementation
1. Keep docs/DESIGN.md; delete the root copy or replace it with a link.
2. Move COLLECTION_EVENTS_DESIGN.md into docs/design/.
3. Update .github/copilot-instructions.md, CLAUDE.md and AGENTS.md to the current APIs and behaviors (operators, transactions, events, errors).
4. Make sure docs:build still works.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Only one DESIGN.md exists (docs/) and design leftovers live under docs/design/
- [ ] #2 Agent instruction files describe the current API (no references to removed or changed behavior)
- [ ] #3 bun run docs:build succeeds
<!-- AC:END -->
