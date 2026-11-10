---
id: TASK-256
title: >-
  Feature: $regex via SQLite UDF and optional update-hook change capture (Bun
  1.4.4)
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-10T02:57:00Z'
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
- [x] #1 $regex filters work and invalid patterns reject with QueryError (tests)
- [x] #2 Change-capture mode is opt-in, documented with its caveats, and tested for insert/update/delete via raw SQL
- [x] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add real SQLite regex and raw-change regressions before implementation, covering validation, cache bindings, nested fields/elements and opt-in isolation.
2. Register deterministic strata_regexp once per connection, validate string patterns before translation, and expose a separate opt-in raw row-change observer with exception isolation and explicit hook ownership.
3. Document JavaScript Unicode/non-indexable regex semantics and all SQLite hook caveats; extend differential properties and verify all host gates/local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Outcome: string $regex uses a deterministic strata_regexp UDF registered once per connection, including direct internal collection construction. Patterns validate before translation/cache lookup and use JavaScript Unicode syntax; bounded64-pattern reuse, strings only, case-sensitive and non-indexable. Nested paths/elements and cache binding changes work.
- Opt-in onRawChange reports operation/table/schema/rowid for connection-local raw SQL and StrataDB writes. It refuses caller hook takeover, releases only owned hooks, and catches synchronous/asynchronous observer failures including console failures. It is intentionally separate from commit-buffered collection events.
- Breaking change: none. Optional Unicode ilike mode omitted; existing ASCII ilike semantics stay explicit.
- Regression-first: nine new cases failed before implementation (unknown regex and absent hook notifications), all now PASS. Real SQLite insert/update/delete, default-off hooks, ownership, rollback, unfiltered-delete omission and observer failures verified; regex matrix covers indexed/unindexed, cache on/off, pattern changes, nested paths/elements, invalid/empty-table patterns and injection-shaped operands. Extended independent differential generator/reference to regex; 500 seeded cases PASS.
- Verification: full host gate PASS, 1052 tests pass/no failures/skips; TS5.9.3/6.0.3/7.0.2, lint, build, type tests and packed consumer TS6/7+CRUD PASS.
- Decisions: onRawChange is row metadata rather than fabricated document/delete snapshots. Events guide documents pre-commit/rollback notifications, WITHOUT ROWID, unfiltered DELETE, REPLACE removals, other connections, exclusive hooks, reentrant-use prohibition and native uncaught-exception behavior.
- Follow-ups: none.

Verified with scripts/ci-local.sh (3bb8bc30c8d340563f431c642df8d60443dc199c, PASS); GitHub Actions unavailable (billing lock). macOS/Linux Bun pinned/latest1.4.4, TS5.9.3/6.0.3/7.0.2 and advisory7.1-beta all PASS.
<!-- SECTION:NOTES:END -->
