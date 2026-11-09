---
id: TASK-242
title: 'Release prep: v0.6.0 (verify, changelog, local tag; do not publish)'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T17:47:00Z'
labels:
  - build-release
milestone: m-1
dependencies:
  - TASK-241
  - TASK-262
documentation:
  - stratadb-audit.md
priority: medium
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Package the safety/correctness release. Publishing is done by the maintainer.

## Implementation
1. Confirm every regression case for A1-A6, A8, A9, A11, A13, A14 and A16 is a normal `test`; the remaining `test.failing` cases (A10, A12, A15, A17) belong to milestone 3.
2. CHANGELOG: `## [0.6.0] - <date>` with the Breaking changes section first.
3. Bump the version to 0.6.0. Run the full verification (TS matrix, lint, test, build, type tests, consumer smoke, pack dry-run).
4. Create local tag `v0.6.0` (do not push). Leave the task In Progress with notes containing the publish commands.

## Not allowed
`npm publish`, `git push --tags`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All regression cases scheduled for 0.6.0 run as normal tests and pass
- [ ] #2 CHANGELOG has a [0.6.0] section with a Breaking changes subsection; package.json version is 0.6.0
- [ ] #3 Local tag v0.6.0 exists; nothing pushed or published; publish commands are in task notes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Maintainer authorization (2026-11-09 mission): pushing, merging and publishing stratadb 0.5.1, 0.6.0 and 0.7.0 are explicitly authorized. This overrides earlier do-not-publish/local-tag-only wording in TASK-226, TASK-242 and TASK-260. Follow mission release procedure R, including local npm publish without --provenance before pushing tags, passing PR CI and merge without squash/rebase. Plan approval is pre-granted. All mission hard rules remain in force.

Current mission overrides local-tag-only wording: push v0.6.0 and merge release/v0.6.0 via normal merge PR after local CI PASS; npm publish is maintainer-only, never run by this agent. TASK-262 is additionally required.
<!-- SECTION:NOTES:END -->
