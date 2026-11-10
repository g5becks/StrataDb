---
id: TASK-252
title: 'Performance: per-collection prepared-statement LRU'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-10T02:26:00Z'
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
- [x] #1 findOne-by-indexed-field benchmark is >= 3x faster than v0.6.0 on the same machine (record both numbers in the PR/notes)
- [x] #2 Statements are finalized on close(), drop() and DDL; using a collection after close() still yields the closed-database error
- [x] #3 The translator SQL cache is removed or kept with benchmark justification in notes
- [x] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Record a reproducible 50,000-call indexed findOne baseline against the retained v0.6.0 tag worktree, and add real statement reuse/eviction/finalization/context regressions before the cache.
2. Add a configurable per-collection prepared-statement LRU, finalize on eviction/close/drop/DDL, preserve current operation error context, and benchmark translator SQL cache on/off.
3. Measure against the same baseline/protocol, make up to three evidenced optimization attempts if needed, run all host gates and local CI, and check the 3x criterion only if achieved.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Baseline protocol added under bench/statement-cache.bench.ts: same 100-document indexed role fixture, 5,000 warm-up calls, five trials of 50,000 awaited findOne calls with row assertions. macOS arm64, Bun 1.4.4, SQLite 3.54.0; baseline imports the retained clean v0.6.0 worktree at 09deee50a78edc1d729f91880b5cd7f9921612f5. Baseline medians: translator cache off 7.3996825 us/op, on 7.1261075 us/op.
- Attempt 1 (LRU plus cached method wrappers with error-only context allocation): off 3.70153082 us/op, on 3.40736918 us/op; about 2x and below the 3x criterion.
- Attempt 2 (simple findOne direct single-row path and trusted constant LIMIT 1, with full-options fallback preserved): off 1.3797925 us/op (5.36x baseline), on 1.12280416 us/op (6.35x baseline). Working-tree measurement; full quality gate and committed-SHA measurement pending. No third optimization attempt needed. Translator caching remains opt-in: about 18.6% lower median latency with the LRU, so it is retained with measurable justification.
- Regression-first statement lifecycle suite: all six cases failed before the cache; they now pass for reuse/bindings, LRU finalization, DDL/close, commit/rollback drop behavior, current error context and capacity/global-cache isolation.

- Implemented a positive-integer configurable per-collection LRU (database/collection statementCacheSize, default 64) without relying on or changing Bun’s global query-cache size. Cached wrappers reuse bound methods and allocate current SQL operation context only on failure. Eviction finalizes native statements; retained wrappers can prepare again safely.
- DDL invalidates caches across the connection, close disposes all cached handles, and committed drops dispose their cache and invalidate factory/schema entries. Rollback retains factory identity. Failed collection initialization disposes its cache. Refactored internal construction into one configuration object to carry capacity and lifecycle behavior without adding parameter suppressions.
- Added option-fallback and retained-wrapper coverage after the six regression-first failures. All eight focused cache cases pass, alongside the existing abort, retry, security, transaction and property suites. Simple findOne uses direct get and a trusted constant LIMIT 1; sorting/search/projection/cursor options preserve the full find path.
- Breaking change: none. Host gate PASS: 1029 pass, 1 existing projection skip, 0 fail; TS 7.0.2 typecheck; lint; build; type tests; consumer TS 6/7 CRUD; source TS 5.9.3/6.0.3. Benchmarks exceed the 3x requirement in both translator-cache settings; committed-SHA measurement and local CI follow.
- Follow-up TASK-267 records pre-existing CRUD benchmark lifecycle/unawaited-setup defects found during harness review. TASK-257 now depends on it, preserving TASK-252, so the tracking workflow will run the complete repaired harness; the new fixed comparison harness is independent of those groups.

- Clean committed-SHA benchmark confirmation: f97828aba30b374d354e6adc0600c309db6193b7, dirty=false, same protocol/Bun/SQLite/platform as baseline 09deee50a78edc1d729f91880b5cd7f9921612f5. Raw trials and metadata retained at /Users/takinprofit/Dev/StrataDb-release/benchmarks/TASK-252/before.json and /Users/takinprofit/Dev/StrataDb-release/benchmarks/TASK-252/after.json; attempted variants retained beside them.

| Translator cache | v0.6.0 us/op | After us/op | Speedup |
| --- | --- | --- | --- |
| off | 7.399683 | 1.366114 | 5.42x |
| on | 7.126107 | 1.123969 | 6.34x |

- Verified with scripts/ci-local.sh (f97828aba30b374d354e6adc0600c309db6193b7, PASS); GitHub Actions unavailable (billing lock). All macOS/Linux Bun and required/advisory TypeScript jobs pass.
<!-- SECTION:NOTES:END -->
