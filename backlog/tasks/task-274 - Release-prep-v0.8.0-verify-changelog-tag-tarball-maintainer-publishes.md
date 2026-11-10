---
id: TASK-274
title: 'Release prep: v0.8.0 (verify, changelog, tag, tarball; maintainer publishes)'
status: To Do
assignee: []
created_date: '2026-11-10T16:03:00Z'
labels:
  - build-release
milestone: m-3
dependencies:
  - TASK-271
  - TASK-272
  - TASK-273
priority: high
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Release prep for v0.8.0. Use `scripts/release.ts` from the previous task, and verify in the task notes that it works end to end.

## Implementation
1. Confirm every other v0.8.0 task is Done and that `grep -rn "test.failing" test/` is empty.
2. The CHANGELOG `[Unreleased]` section lists the Breaking changes (serializer and Date policy, Unicode folding) with migration steps. Update the migration guide in docs with a 0.7 → 0.8 section.
3. Run `bun run release:prepare 0.8.0` on `release/v0.8.0`.
4. Follow the merge procedure the maintainer authorizes: push the branch, open a PR with the ci-local results as a comment, merge without squashing, push the tag. **Do not publish**; the maintainer publishes with interactive 2FA.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All other v0.8.0 tasks are Done; no test.failing remains; quality gate passes
- [ ] #2 CHANGELOG [0.8.0] has Breaking changes with migration steps; docs include a 0.7 to 0.8 migration section
- [ ] #3 release:prepare 0.8.0 produced the tag, ci-local PASS on tag and branch, a verified tarball, SHA-512 and RELEASE_NOTES.md
- [ ] #4 Release PR merged without squash and tag pushed (if authorized); npm publish left to the maintainer with exact commands in notes
<!-- AC:END -->
