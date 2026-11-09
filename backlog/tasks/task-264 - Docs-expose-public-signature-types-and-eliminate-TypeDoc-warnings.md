---
id: TASK-264
title: 'Docs: expose public signature types and eliminate TypeDoc warnings'
status: To Do
assignee: []
created_date: '2026-11-09T20:17:00Z'
labels:
  - docs
milestone: m-2
dependencies:
  - TASK-241
documentation:
  - stratadb-audit.md
priority: medium
type: docs
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-241 docs build succeeds, but TypeDoc reports named public signature/context types omitted from the root exports: CollectionOptions, RetryableOptions and SQLiteErrorContext. It also reports duplicate remarks/returns tags on Collection.search. Expose and document the named types without removing compatibility exports, correct duplicate tags, and regenerate the final API pages after the DX changes. The VitePress chunk-size advisory is separate and must not be suppressed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Named public signature/context types are importable from stratadb and have generated API documentation
- [ ] #2 Duplicate comment tags and TypeDoc not-exported/link warnings are resolved without suppressing validation
- [ ] #3 docs:build and the full quality gate pass; generated API links and formatting are reviewed
<!-- AC:END -->
