---
id: TASK-248
title: 'DX: detect schema mismatch on cached collections; unify creation paths'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-10T01:05:00Z'
labels:
  - api
milestone: m-2
dependencies:
  - TASK-242
documentation:
  - stratadb-audit.md
priority: low
type: enhancement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
`db.collection(name, schema)` returns the cached instance even when a different schema is passed. The builder and createSchema paths plumb options differently (the builder skips retry defaults). Audit ref: A21.

## Implementation
1. Compare the schema (structural hash) on cached lookups and throw SchemaValidationError on mismatch.
2. Route both creation paths through one factory so enableCache and retry defaults apply identically. Add tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Calling db.collection(name, otherSchema) after db.collection(name, schema) throws SchemaValidationError (test)
- [x] #2 Builder-created and schema-created collections receive identical cache and retry defaults (test)
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add regressions for cached schema mismatches, equivalent schemas across creation styles, and identical cache/retry/timestamp defaults.
2. Fingerprint normalized schema structure plus validator identity at cache insertion, reject mismatches, and route fluent build through the same collection factory.
3. Document cache identity/options and builder-default behavior, then run all host gates and local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Cached lookups compare SHA-256 fingerprints of normalized schema declarations. Fields/index declarations are order-normalized, ordinary omitted defaults and automatic paths are normalized, and compound index field order remains significant. Tagged canonical values avoid sentinel collisions; validator functions use reference identity so closures are never equated by source text. Circular metadata rejects with SchemaValidationError.
- Fluent build routes through Strata.collection and its cache/retry factory. Equivalent schema/fluent declarations return the same collection; different fields/types/indexing/uniqueness/defaults/timestamps/validators/compound orders reject. Builder cache overrides remain effective; database retries and default enabled timestamps now apply identically. Existing cached access after close is preserved, while async methods retain typed promise rejections.
- Regression-first suite initially had 11 failures and 2 passing schema-style controls; final 15 cases pass, including actual retry recovery and cache enablement in both styles. Updated internal constructor fixtures for the shared factory and strengthened the real database builder test with actual schema assertions. Existing close/dispose guarantees pass unchanged.
- Breaking change: mismatched cached schemas reject; fluent collections are cached, inherit retry defaults and default visible timestamps. Keep shared validator references and use timestamps(false) explicitly when needed. Later lookup options do not reconfigure an existing collection. Documented in CHANGELOG/schema guide.
- Host gate PASS: 977 pass, 1 existing projection skip, 0 fail; TS 7.0.2 typecheck; lint; build; type tests; consumer TS 6/7 CRUD; source TS 5.9.3/6.0.3. Local CI pending committed SHA.
<!-- SECTION:NOTES:END -->
