---
id: TASK-275
title: >-
  Toolchain: adopt TypeScript 7.1 GA and remove the TypeScript 6 docs workaround
  (upstream-gated)
status: To Do
assignee: []
created_date: '2026-11-10T16:03:00Z'
updated_date: '2026-11-10T16:23:00Z'
labels:
  - toolchain
  - upstream-gated
dependencies: []
priority: low
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Two temporary workarounds wait on upstream releases:
- TypeScript 7.1 is in beta (7.1.0-beta, advisory in CI);
- TypeDoc doesn't support the TypeScript 7 compiler API, so the docs build in a private TypeScript 6 workspace (TASK-220).

## Precondition (check first; if it isn't met, leave this task To Do and add a note with the date checked)
- `npm view typescript dist-tags.latest` is 7.1.x (GA), **and/or**
- a TypeDoc release supports TypeScript 7 (check its changelog and peerDependencies).

## Implementation
- **When TS 7.1 is GA:** make 7.1 the dev compiler and drop the beta advisory entry (or replace it with the next beta) in ci.yml and scripts/ci-local.sh; the TS 5.9/6.0/7.0 matrix stays.
- **When TypeDoc supports TS 7:** remove the TS 6 docs workspace workaround, regenerate the API docs, and keep zero TypeDoc warnings (TASK-264).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Precondition checked and recorded with date; if unmet, task stays To Do
- [ ] #2 If TS 7.1 is GA: dev compiler is 7.1, ci.yml and ci-local.sh matrices updated together, gates pass
- [ ] #3 If TypeDoc supports TS 7: docs build on the root TS 7 toolchain with zero warnings and the TS 6 docs workspace is removed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Precondition check, 2026-11-10 (after v0.8.0 merge/tag push): npm view typescript dist-tags.latest returned 7.0.2, so TypeScript 7.1 GA is unavailable.
- npm view typedoc version peerDependencies --json returned 0.28.20, with TypeScript peers 5.0.x through 5.9.x or 6.0.x; TS 7 is excluded. GitHub latest release is v0.28.20 (2026-07-05): https://github.com/TypeStrong/typedoc/releases/tag/v0.28.20. Its release notes and https://typedoc.org/documents/Changelog.html do not announce TS 7 support (TS 6 support was added in 0.28.18).
- Neither precondition is met. Leave TASK-275 To Do; root compiler, advisory beta and TS 6 docs workspace stay as configured. No chore/ts-7.1 branch or toolchain implementation. TASK-276 untouched.
<!-- SECTION:NOTES:END -->
