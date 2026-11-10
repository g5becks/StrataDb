---
id: TASK-257
title: 'Performance: benchmark tracking workflow'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-10T13:43:00Z'
labels:
  - performance
  - build-release
milestone: m-2
dependencies:
  - TASK-252
  - TASK-267
documentation:
  - stratadb-audit.md
priority: low
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
The mitata benchmarks exist but are not tracked over time, so regressions are invisible. Audit ref: Q7.

## Implementation
Add a workflow (workflow_dispatch + weekly schedule) that runs `bun run bench:all` and uploads results as an artifact. Optionally compare with the previous artifact and comment on large regressions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A workflow runs bench:all on demand and weekly and uploads results as an artifact
- [x] #2 README or CONTRIBUTING explains how to read the benchmark artifact
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add manual/weekly benchmark workflow with SHA-pinned actions, fixed Bun, runtime/source metadata, strict bench:all output and retained artifacts.
2. Document artifact interpretation, comparable environments and local reproduction during the billing lock; record existing valid local baselines.
3. Validate file criteria and actionlint, run the full host gate and committed local CI; report local evidence only.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Outcome: benchmarks.yml defines workflow_dispatch and Sunday03:45UTC schedule, fixed Bun1.4.4, frozen installation, source/runtime/OS/SQLite metadata, strict bench:all output, fixed statement/projection JSON protocols, and90-day artifacts uploaded even after a benchmark failure. Every action is pinned by SHA; upload-artifact v4.6.2 pin was verified with git ls-remote.
- Breaking change: none.
- Verification: workflow criteria verified from file contents; bunx --bun actionlint PASS. Full host gate PASS,1055 tests/no failures/skips, TS5.9.3/6.0.3/7.0.2, lint, build, type tests and packed consumer TS6/7+CRUD. Local CI pending committed workflow. GitHub Actions unavailable (billing lock); no workflow execution claimed. ci.yml unchanged, so ci-local.sh requires no corresponding edit.
- Local baseline reused from TASK-267 successful bench:all:103 result rows,43 retained CRUD cases; Bun1.4.4/Apple M5/macOS arm64. Means: cached translation179.50ns, findById866.10ns, indexed findOne1.51us, atomic findOneAndUpdate6.24us; raw /Users/takinprofit/Dev/StrataDb-release/benchmarks/TASK-267/after-all.log. Fixed-protocol before/after medians remain in TASK-252/253/258 and their raw JSON artifacts.
- Decisions: keep artifacts and environment metadata, without automatic PR comments or uncalibrated regression thresholds. CONTRIBUTING distinguishes means/medians and partial failure artifacts and documents local reproduction during billing lock.
- Follow-ups: none.

Verified with scripts/ci-local.sh (7701141de7e8f60268bc98c684684dca63d00727, PASS); GitHub Actions unavailable (billing lock). macOS/Linux Bun pinned/latest1.4.4, source/type suites TS5.9.3/6.0.3/7.0.2 and advisory7.1-beta all PASS; actionlint PASS. Weekly/manual triggers, strict benchmark command and artifact upload verified from the file; no GitHub execution claimed.
<!-- SECTION:NOTES:END -->
