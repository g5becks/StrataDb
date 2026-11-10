---
id: TASK-260
title: 'Release prep: v0.7.0 (verify, changelog, local tag; do not publish)'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-10T01:16:00Z'
labels:
  - build-release
milestone: m-2
dependencies:
  - TASK-243
  - TASK-244
  - TASK-245
  - TASK-246
  - TASK-247
  - TASK-248
  - TASK-249
  - TASK-250
  - TASK-251
  - TASK-252
  - TASK-253
  - TASK-254
  - TASK-255
  - TASK-256
  - TASK-257
  - TASK-258
  - TASK-259
  - TASK-264
  - TASK-265
documentation:
  - stratadb-audit.md
priority: medium
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Package the DX and performance release. Publishing is done by the maintainer.

## Implementation
1. Confirm no `test.failing` cases remain in test/regression.
2. CHANGELOG `## [0.7.0] - <date>`; bump version to 0.7.0.
3. Run the full verification (TS matrix, lint, test, build, type tests, consumer smoke, pack dry-run, benchmarks recorded).
4. Create local tag v0.7.0 (do not push). Leave the task In Progress with notes containing the publish commands.

## Not allowed
`npm publish`, `git push --tags`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No test.failing cases remain in test/regression
- [ ] #2 CHANGELOG has a [0.7.0] section; package.json version is 0.7.0; all verification commands pass
- [ ] #3 Local tag v0.7.0 exists; nothing pushed or published; publish commands are in task notes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Maintainer authorization (2026-11-09 mission): pushing, merging and publishing stratadb 0.5.1, 0.6.0 and 0.7.0 are explicitly authorized. This overrides earlier do-not-publish/local-tag-only wording in TASK-226, TASK-242 and TASK-260. Follow mission release procedure R, including local npm publish without --provenance before pushing tags, passing PR CI and merge without squash/rebase. Plan approval is pre-granted. All mission hard rules remain in force.

Current mission overrides local-tag-only wording: push v0.7.0 and merge release/v0.7.0 via normal merge PR after local CI PASS; npm publish is maintainer-only, never run by this agent.
<!-- SECTION:NOTES:END -->
