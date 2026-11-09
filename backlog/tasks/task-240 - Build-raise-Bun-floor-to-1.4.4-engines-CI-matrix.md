---
id: TASK-240
title: 'Build: raise Bun floor to >=1.4.4 (engines + CI matrix)'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T20:12:00Z'
labels:
  - build-release
milestone: m-1
dependencies:
  - TASK-227
documentation:
  - stratadb-audit.md
priority: medium
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Decision baked in from audit 1B-B4: StrataDB 0.6.0 requires Bun >= 1.4.4. That release has update hooks and UDFs, the ALTER TABLE stale-statement fix needed for schema evolution, correct `changes` counts, SQLITE_ERROR codes and the rejected-promise transaction fix. agentx upgrades Bun 1.3.14 → 1.4.4 in the same window. If the maintainer prefers >=1.3.14, change this task before starting it.

## Implementation
1. `engines.bun` ">=1.4.4".
2. CI Bun matrix: floor 1.4.4 + latest.
3. Remove compatibility fallbacks that only exist for Bun < 1.4.4 (none expected; check).
4. README Installation section: state the requirement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 package.json engines.bun is >=1.4.4 and README states the requirement
- [x] #2 CI tests on Bun 1.4.4 and the latest Bun
- [x] #3 CHANGELOG.md has an entry under ## [Unreleased] describing the change (Breaking changes section)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Confirm the declared engine, CI/local-runner matrices and any older-runtime compatibility code.
2. Set engines.bun >=1.4.4 and document the Bun-only minimum and migration.
3. Run the full host gate, actionlint and committed local CI; record the existing floor/latest matrix verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Set package engines.bun to >=1.4.4 and state the minimum in README Installation. CI and ci-local already specify floor 1.4.4 plus latest, so neither workflow nor runner required a change. No older-Bun runtime compatibility fallbacks were found. The SQLite >=3.45 engine guard remains required independently of the Bun version.
- Breaking change: applications must upgrade Bun before StrataDB 0.6.0. Output names remain dist/index.mjs and dist/index.d.mts. CHANGELOG updated.
- Host gate PASS: typecheck TS 7.0.2; lint 103 files; 874 pass/2 existing skips/0 fail; build; type tests; consumer TS 6/7 and CRUD; source TS 5.9.3/6.0.3; actionlint PASS. Local CI pending committed SHA.

Verified with scripts/ci-local.sh (d1fdcbde2437c08eb6dfadf23fc14a05b8a3f971, PASS); GitHub Actions unavailable (billing lock). macOS/Linux pinned/latest Bun 1.4.4 PASS; TS 5.9.3/6.0.3/7.0.2 source/type tests PASS; TS 7.1.0-beta advisory PASS; actionlint PASS. Logs: /Users/takinprofit/Dev/StrataDb-release/ci-local/d1fdcbd/logs. Workflow and fallback matrices already match; no paired CI edit was needed. Self-review complete.
<!-- SECTION:NOTES:END -->
