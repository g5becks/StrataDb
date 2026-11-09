---
id: TASK-241
title: 'Docs: README corrections, semantics page and 0.6 migration guide'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T20:26:00Z'
labels:
  - build-release
milestone: m-1
dependencies:
  - TASK-228
  - TASK-229
  - TASK-230
  - TASK-231
  - TASK-232
  - TASK-233
  - TASK-234
  - TASK-235
  - TASK-236
  - TASK-237
  - TASK-238
  - TASK-239
  - TASK-240
documentation:
  - stratadb-audit.md
priority: medium
type: docs
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
README and docs claim behavior that is fixed or changed in 0.6.0 (retries, compound indexes, timestamps, $like/$ilike, caseSensitive, transactions). Consumers need a migration guide for the breaking changes. Audit refs: C7, SDB-22.

## Implementation
1. Update the README sections: Automatic Retries, Collection Events (delivery guarantees), Type Safety, operators.
2. Add docs/guide pages: "Semantics vs MongoDB" (if not already added) and "Migrating to 0.6".
3. CHANGELOG `[Unreleased]`: consolidate a "Breaking changes" section covering strict operators, null/$ne semantics, LIKE case, async-only errors, transaction serialization, event timing and the Bun floor.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README no longer describes any behavior contradicted by tests (retries, compound indexes, timestamps, LIKE, events)
- [x] #2 docs/guide contains a Migrating to 0.6 page listing every breaking change with before/after code
- [x] #3 bun run docs:build succeeds
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reconcile README and relevant guides against the passing safety/correctness tests, preserving accurate retry documentation while its default-policy follow-up remains pending.
2. Add a 0.6 migration guide with before/after examples for every breaking change; link it and the semantics guide from navigation and CHANGELOG.
3. Update transaction, event, string, schema and runtime guidance, then build docs and run the full host quality gate.
4. Self-review links/examples and verify local CI if documentation build configuration changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Added and linked Migrating to 0.6 with before/after examples for runtime, Promise errors, strict operators/identifiers/options, null/negative filters, string matching, transactions, events and unique compound enforcement. It also covers timestamp opt-out, typed errors and retry policy. CHANGELOG Breaking changes links the migration/semantics guides.
- Corrected README feature/type-safety claims, retry configuration with an explicit tested classifier, literal/case semantics, compound indexes, timestamps and event guarantees. Updated installation, schemas, transactions, troubleshooting and public API comments; removed contradictory nested-transaction guidance. Navigation includes both guides.
- Regenerated tracked API documentation, including new error classes. Extended the existing finalizer to remove generated signature whitespace; git diff --check is clean.
- Breaking change: none in this documentation task; it documents preceding behavior changes. Retry default wiring remains TASK-261; current README uses an explicit classifier, so its example matches current tests.
- Verification PASS: frozen docs install; docs:build (TypeDoc on TS 6 and VitePress, 3.62s); typecheck TS 7.0.2; lint 103 files; 874 pass/2 existing skips/0 fail; build; type tests; consumer TS 6/7 and CRUD; source TS 5.9.3/6.0.3.
- Docs build has seven TypeDoc warnings (public named types/duplicate tags) tracked in new m-2 TASK-264; TASK-260 retains its dependencies and additionally depends on TASK-264. VitePress chunk-size advisory remains unsuppressed. Local CI pending committed SHA because docs configuration/finalizer changed.

Verified with scripts/ci-local.sh (1c193a4221ca90662fb8bccd4c9a263ed4d8a229, PASS); GitHub Actions unavailable (billing lock). macOS/Linux pinned/latest Bun 1.4.4 PASS; TS 5.9.3/6.0.3/7.0.2 source/type tests PASS; TS 7.1.0-beta advisory PASS. Logs: /Users/takinprofit/Dev/StrataDb-release/ci-local/1c193a4/logs. Self-review complete.
<!-- SECTION:NOTES:END -->
