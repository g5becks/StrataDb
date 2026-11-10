---
id: TASK-253
title: 'Performance: push inclusion projections into SQL'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-10T02:36:00Z'
labels:
  - performance
milestone: m-2
dependencies:
  - TASK-252
documentation:
  - stratadb-audit.md
priority: low
type: enhancement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
find() selects and parses whole documents, then drops fields in JS. Audit ref: P3.

## Implementation
For inclusion projections, build `json_object('a', jsonb_extract(body, ?), ...)` (paths via the FieldResolver) and parse only that; keep the JS path for exclusion projections. Benchmark wide documents (50 fields) projecting 2 fields.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Inclusion projections are computed in SQL (test inspects generated SQL)
- [x] #2 A wide-document benchmark shows a measurable improvement (numbers recorded in notes)
- [x] #3 Projection behavior is unchanged (existing projection tests pass)
- [x] #4 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #5 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Record a 50-field/two-field inclusion baseline before implementation and add SQL-shape, JSON-type, missing-field, metadata, key-order and exclusion compatibility regressions.
2. Build inclusion JSON in SQL using bound literal field keys and ordered JSON aggregation, preserving own stored values and timestamp/ID rules; retain JavaScript exclusion behavior.
3. Enable the existing complex projection case, record the same benchmark after the change, document results, run all host gates and local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Outcome: inclusion JSON is constructed in SQLite with bound literal keys/paths; missing keys, booleans, nulls, arrays, objects, metadata and order are preserved. Exclusion stays in JavaScript. Large selections use ordered aggregation to avoid SQLite argument/compound limits.
- Breaking change: none.
- Regression-first: SQL inspection failed on full json(body) before implementation; three compatibility controls passed. Six focused cases now pass, including 600 fields and quoted/backslash/NUL/injection-shaped literal keys. Enabled the existing complex projection test by explicitly selecting timestamps its unchanged assertions require.
- Benchmark: Bun 1.4.4/macOS arm64; 50 fields x512 bytes, select two; 5000 warmup, five x50000 reads. Before median 9.99448 us; final implementation 8.38393584 us (16.1% lower latency). Initial json_each/UNION approaches were slower and replaced with direct json_object plus missing-key removal for small projections. Raw samples: /Users/takinprofit/Dev/StrataDb-release/benchmarks/TASK-253/{before,attempt1,attempt2,attempt3}.json. Baseline source 76a1f03, dirty only for task metadata at measurement.
- Verification: typecheck, lint, full bun test, build, type tests, packed consumer TS6/7 and CRUD, source TS5.9.3/6.0.3 PASS; local CI pending committed implementation.
- Decisions: preserve literal top-level projection semantics; FieldResolver owns literal JSON path encoding.
- Follow-ups: none.

- Verified with scripts/ci-local.sh (c4568723dc5fdd2ae8d02ee3001b1cece519adda, PASS); GitHub Actions unavailable (billing lock). macOS/Linux Bun pinned/latest 1.4.4, TS5.9.3/6.0.3/7.0.2 and advisory7.1-beta all PASS.
- Clean committed benchmark confirmation: median8.4598825 us/read, 15.4% lower latency; after.json records SHA and dirty:false.
- Full host suite: 1036 pass, 0 fail, 0 skip.
<!-- SECTION:NOTES:END -->
