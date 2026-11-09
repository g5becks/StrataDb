---
id: TASK-252
title: 'Performance: per-collection prepared-statement LRU'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - performance
milestone: m-2
dependencies:
  - TASK-243
documentation:
  - stratadb-audit.md
priority: high
type: enhancement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Every operation calls `db.prepare()` (13 sites, 0 cached). Measured on findOne by indexed field: StrataDB 3.4 µs/op vs cached `db.query` 0.6 µs/op; about 60% of per-call cost is re-preparing. Bun's `db.query()` cache is only 20 entries per connection, and `Database.MAX_QUERY_CACHE_SIZE` is a process-wide static, so do not rely on or mutate it. Audit refs: P1, P2, 1B-B2.

## Implementation
1. Add a per-collection LRU of prepared statements keyed by SQL text (configurable size, default ~64).
2. Finalize statements on close(), drop() and after DDL (schema evolution).
3. Benchmark: findOne by indexed field, x50k (bench/crud-operations.bench.ts).
4. Re-evaluate the translator's SQL-string cache (P2); remove it if the statement cache makes it redundant (benchmark both).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 findOne-by-indexed-field benchmark is >= 3x faster than v0.6.0 on the same machine (record both numbers in the PR/notes)
- [ ] #2 Statements are finalized on close(), drop() and DDL; using a collection after close() still yields the closed-database error
- [ ] #3 The translator SQL cache is removed or kept with benchmark justification in notes
- [ ] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [ ] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->
