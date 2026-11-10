---
id: TASK-267
title: 'Benchmarks: repair CRUD harness lifecycle and awaited setup'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-10T02:13:00Z'
updated_date: '2026-11-10T13:38:00Z'
labels:
  - performance
milestone: m-2
dependencies:
  - TASK-230
documentation:
  - stratadb-audit.md
priority: medium
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Source review during P1/TASK-252 found CRUD benchmark groups that close their shared database during registration, before mitata runs callbacks, and seed/delete setup that reads fields from an unawaited insertOne promise. Repair the harness before the benchmark-tracking workflow, retaining all cases and separating setup/cleanup from timed operations appropriately.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All existing CRUD benchmark cases are retained and complete against live databases without closed-database or unhandled-promise failures
- [x] #2 Shared setup and insert results are awaited where needed, and shared databases are closed only after benchmark execution
- [ ] #3 The runner fails on benchmark errors; bench:all, the host quality gate and required local CI checks pass, with local results recorded
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Run the existing CRUD harness to record the lifecycle/setup failure before repairs.
2. Await asynchronous group setup/insert results, retain shared databases through execution with final cleanup, preserve all benchmark cases, and make benchmark runners fail on errors.
3. Verify deliberate runner failure, run bench:all alone and record valid local baselines, then run the full host gate and local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Outcome: retained all43 CRUD benchmark cases, awaited asynchronous group setup and insert results, kept all shared fixtures live through execution, and closed them in finally. Per-operation fresh-database cases retain their original timing boundary. All three suite runners use supported mitata options with throw:true and plain-text output.
- Breaking change: none.
- Regression-first: the original CRUD run exited1 with closed-database ConnectionError and an unhandled insert rejection. Repaired bench:all exited0 with103 result rows across query/CRUD/batch suites and no benchmark errors. An intentional throwing mitata case using the committed runner option pattern exited1, proving propagation. Case-name comparison confirmed all43 original CRUD cases in the original order.
- Local baseline: Bun1.4.4, Apple M5/macOS arm64. Means: warm cached translation179.50ns; findById866.10ns; indexed findOne1.51us; full100-row find37.51us; single-field update including fresh DB setup117.66us; atomic findOneAndUpdate6.24us; distinct indexed age24.20us. Full raw results /Users/takinprofit/Dev/StrataDb-release/benchmarks/TASK-267/after-all.log; original failure before.log and deliberate error proof error-propagation.log retained. The failed original aggregate is not a valid comparable baseline.
- Verification: bench:all PASS, full host gate PASS with1055 tests/no failures/skips, source TS5.9.3/6.0.3/7.0.2, lint, build, type tests and packed consumer TS6/7+CRUD. Committed local CI pending.
- Decisions: use mitata native async group support and throw propagation; no case removal, timing shortcuts or temporary cache changes.
- Follow-ups: TASK-257 will publish these formats as workflow artifacts when Actions is available.
<!-- SECTION:NOTES:END -->
