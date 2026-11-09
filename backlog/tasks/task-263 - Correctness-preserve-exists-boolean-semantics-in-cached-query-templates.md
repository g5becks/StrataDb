---
id: TASK-263
title: 'Correctness: preserve $exists boolean semantics in cached query templates'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T18:02:00Z'
updated_date: '2026-11-09T20:37:00Z'
labels:
  - api
milestone: m-1
dependencies:
  - TASK-229
documentation:
  - stratadb-audit.md
priority: high
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
During query safety review, a real translator with caching enabled produced IS NOT NULL for both {count: {$exists: true}} and a subsequent {count: {$exists: false}}: cache keys encode only boolean type, while SQL depends on the boolean value. Preserve correct boolean semantics across cache hits. Also explicitly enable caching in the new binding-order and malformed-cache regression fixtures (database caching defaults off), so those tests exercise their claimed paths.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Real SQLite cached and uncached $exists queries agree for present, null and missing fields, in both true/false call orders
- [x] #2 SQL-dependent boolean values cannot reuse an incompatible cached template
- [x] #3 Binding-order and malformed-value cache regression fixtures explicitly enable caching and pass the full quality gate
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add real SQLite cached/uncached exists regressions for both boolean orders, strings/null/missing and indexed/nested fields; explicitly enable cache fixtures.
2. Resolve presence from the original JSON body and preserve SQL-dependent boolean cache keys and binding order.
3. Update semantics documentation, run all host gates and local CI, then record verified results.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Presence is resolved centrally with json_type(body, boundPath), including indexed fields, so explicit JSON null remains present and extracted strings are never reparsed as JSON. Built-in metadata uses its dedicated column. True/false exists values now produce distinct cache keys, and presence-path bindings remain aligned with mixed operators in either order.
- Regression-first evidence: all nine new cases failed before implementation (eight real-SQLite malformed JSON failures and one incompatible-cache SQL assertion). All now pass. Matrix covers indexed/unindexed fields, cache on/off, both true/false orders, nested and missing-parent paths, explicit null/string/missing values, repeated calls, mixed operator orders and metadata.
- Explicitly enabled caching in the existing repeated-path binding-order and malformed-value cache fixtures; both pass. Updated exact translator SQL assertions for bound original-body presence inspection, preserving assertion strength.
- Breaking change: none; corrected documented presence semantics. Updated the semantics guide and CHANGELOG. Host verification PASS: 891 pass, 2 existing skips, 0 fail; TS 7.0.2 typecheck, lint, build, type tests, consumer TS 6/7 CRUD, source TS 5.9.3/6.0.3. Local CI pending committed SHA.

- Verified with scripts/ci-local.sh (ad55c9cc11ac65a62a6bd234ef932b26cf5572b3, PASS); GitHub Actions unavailable (billing lock). macOS/Linux Bun 1.4.4 (also latest), TS 5.9.3/6.0.3/7.0.2 and advisory 7.1.0-beta all pass.
<!-- SECTION:NOTES:END -->
