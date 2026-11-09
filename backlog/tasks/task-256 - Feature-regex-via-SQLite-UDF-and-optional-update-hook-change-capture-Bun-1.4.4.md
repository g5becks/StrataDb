---
id: TASK-256
title: >-
  Feature: $regex via SQLite UDF and optional update-hook change capture (Bun
  1.4.4)
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - api
  - performance
milestone: m-2
dependencies:
  - TASK-242
documentation:
  - stratadb-audit.md
priority: low
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Bun 1.4.4 adds `db.function()`/`db.aggregate()` (UDFs) and row-level update hooks. UDFs enable a `$regex` operator and Unicode-aware case folding. Hooks enable optional change capture, with caveats: not commit-aware, skipped for unfiltered DELETE and INSERT OR REPLACE, one hook per Database, throws become uncaught exceptions. Audit ref: 1B-B2.

## Implementation
1. Add a `$regex` operator via `db.function("strata_regexp", { deterministic: true }, ...)`, registered once per Database, validating the pattern, and documented as non-indexable.
2. Optional: a Unicode-aware `$ilike` mode using a UDF.
3. Optional (behind an option, off by default): a change-capture mode via `onInsert`/`onUpdate`/`onDelete` that emits events for writes made outside StrataDB, documented with all caveats.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 $regex filters work and invalid patterns reject with QueryError (tests)
- [ ] #2 Change-capture mode is opt-in, documented with its caveats, and tested for insert/update/delete via raw SQL
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
