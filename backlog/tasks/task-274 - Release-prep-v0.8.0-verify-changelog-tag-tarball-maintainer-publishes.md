---
id: TASK-274
title: 'Release prep: v0.8.0 (verify, changelog, tag, tarball; maintainer publishes)'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-10T16:03:00Z'
updated_date: '2026-11-10T16:22:00Z'
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
- [x] #1 All other v0.8.0 tasks are Done; no test.failing remains; quality gate passes
- [x] #2 CHANGELOG [0.8.0] has Breaking changes with migration steps; docs include a 0.7 to 0.8 migration section
- [x] #3 release:prepare 0.8.0 produced the tag, ci-local PASS on tag and branch, a verified tarball, SHA-512 and RELEASE_NOTES.md
- [x] #4 Release PR merged without squash and tag pushed (if authorized); npm publish left to the maintainer with exact commands in notes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Confirm TASK-271/272/273 Done, no test.failing, and migration-ready changelog/docs; commit reviewed preparation.
2. Run release:prepare 0.8.0 and require ci-local PASS on both tag and release branch; retain and verify artifacts.
3. Push release branch, open PR with changelog and both CI tables, merge without squash/admin, verify tag ancestry and push tag.
4. Record PR/merge/tag/artifact/digest and maintainer publication commands, close task on main and push backlog closure.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Outcome: v0.8.0 merged without squash via https://github.com/g5becks/StrataDb/pull/4; merge commit d46a56f5cb43178a77b6a14a6b1ec9dd2140dcdf has two parents. Annotated tag v0.8.0 points to 7770c13556db92b6ef71aab7ff59c3c4757573df, is an ancestor of main, and is pushed.
- Breaking changes: path-aware JSON rejection with explicit Date conversion; Unicode NFC/lowercase matching. CHANGELOG 0.8.0 and the 0.7-to-0.8 migration guide include migration steps.
- Verification: TASK-271/272/273 Done; no test.failing; 1162 tests pass; all required quality gates and TS 5.9.3/6.0.3 checks pass. release:prepare 0.8.0 completed end to end. Verified with scripts/ci-local.sh (7770c13556db92b6ef71aab7ff59c3c4757573df, PASS) independently on v0.8.0 and release/v0.8.0; GitHub Actions unavailable (billing lock). macOS/Linux Bun 1.4.4 (also latest), TS 5.9.3/6.0.3/7.0.2 and advisory 7.1.0-beta all pass. Both tables posted at https://github.com/g5becks/StrataDb/pull/4#issuecomment-6772762927.
- Artifacts: /Users/takinprofit/Dev/StrataDb-release/v0.8.0/stratadb-0.8.0.tgz; SHA512SUMS, RELEASE_NOTES.md, CI_LOCAL.log and CI_LOCAL_BRANCH.log retained alongside it. Archive allowlist/exports and isolated consumer CRUD verified.
- SHA-512: 40a23dccfa19fd0ad443cf9b5f3ac11f9b0793cf336f91bcf5e1f94a965d2ff242fbcff8db1d31e3fe72312afaff98db3406283f605fa580c5d72c4186c9cd2c
- Decisions: npm publish pending maintainer (interactive 2FA). No publication or GitHub release performed.
- Benchmarks: see TASK-271 and TASK-272; release tooling not benchmarked.

Maintainer commands:
```bash
cd /Users/takinprofit/Dev/StrataDb-release/v0.8.0 && npm publish ./stratadb-0.8.0.tgz --access public
npm view stratadb@0.8.0 version
gh release create v0.8.0 --verify-tag --title v0.8.0 --notes-file /Users/takinprofit/Dev/StrataDb-release/v0.8.0/RELEASE_NOTES.md
```
<!-- SECTION:NOTES:END -->
