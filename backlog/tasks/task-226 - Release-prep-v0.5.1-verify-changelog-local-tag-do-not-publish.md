---
id: TASK-226
title: 'Release prep: v0.5.1 (verify, changelog, local tag; do not publish)'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - build-release
milestone: m-0
dependencies:
  - TASK-214
  - TASK-215
  - TASK-216
  - TASK-217
  - TASK-218
  - TASK-219
  - TASK-220
  - TASK-221
  - TASK-222
  - TASK-223
  - TASK-224
  - TASK-225
documentation:
  - stratadb-audit.md
priority: medium
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Package the non-breaking guardrail work as v0.5.1. Publishing is done by the maintainer.

## Implementation
1. Move the CHANGELOG `[Unreleased]` entries to `## [0.5.1] - <date>`.
2. Bump package.json to 0.5.1.
3. Run the full verification: typecheck (TS 5.9/6/7), lint, test, build, type tests, consumer smoke, `bun pm pack --dry-run`.
4. Create a local annotated tag `v0.5.1` **without pushing**, plus the retroactive tag `v0.5.0` on the commit that published 0.5.0 (find it via CHANGELOG/git log). Do not push.
5. STOP. Leave the task in "In Progress" with notes listing the exact publish commands for the maintainer (`git push --tags`, `npm publish --provenance`).

## Not allowed
`npm publish`, `git push --tags`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CHANGELOG.md has a [0.5.1] section covering every task in this milestone
- [ ] #2 package.json version is 0.5.1 and all verification commands pass
- [ ] #3 Local tags v0.5.0 (retroactive) and v0.5.1 exist; nothing is pushed or published
- [ ] #4 Task notes contain the exact publish commands for the maintainer
<!-- AC:END -->
