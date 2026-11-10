---
id: TASK-259
title: 'Docs: deduplicate design docs and update agent instructions'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-10T13:18:00Z'
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
- [x] #1 Only one DESIGN.md exists (docs/) and design leftovers live under docs/design/
- [x] #2 Agent instruction files describe the current API (no references to removed or changed behavior)
- [x] #3 bun run docs:build succeeds
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep docs/DESIGN.md as the current architecture, preserve historical proposals under docs/design and remove duplicate root design files.
2. Add current project/API guidance to AGENTS.md and replace duplicated Claude/Copilot guidance with concise current instructions linked to it.
3. Review links/API statements, regenerate/build docs, run the full host quality gate and record existing warnings owned by TASK-264.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Outcome: docs/DESIGN.md is the sole current architecture; duplicate root DESIGN.md removed. Original docs proposal and collection-events proposal are explicitly historical under docs/design, with the small root-to-docs proposal diff retained instead of another4000-line copy. Architecture is linked from the guide sidebar.
- Agent guidance: AGENTS.md now describes the current storage/API, operators, atomic writes, savepoints, events/errors, readonly mode, raw observers, modular source layout, Bun/TypeScript gates and maintainer-only publishing. CLAUDE.md and Copilot instructions are concise current guidance linked to AGENTS rather than repeated generic framework/lint/backlog material. The managed Backlog block remains intact in AGENTS.
- Breaking change: none.
- Verification: docs:build PASS with links/rendering reviewed; only docs/DESIGN.md matches the DESIGN.md filename. Full host gate PASS:1052 tests, no failures/skips, TS5.9.3/6.0.3/7.0.2, lint, build, type tests and packed consumer TS6/7+CRUD. Last committed code CI73ac32f PASS; this task changes documentation only.
- Decisions: preserve proposals for history with prominent current-design links; agent instructions and canonical architecture state current behavior rather than historical sketches.
- Follow-ups: existing TASK-264 owns12 unsuppressed TypeDoc public-type/link warnings after modular contract extraction. Existing VitePress chunk-size advisory remains unsuppressed.
<!-- SECTION:NOTES:END -->
