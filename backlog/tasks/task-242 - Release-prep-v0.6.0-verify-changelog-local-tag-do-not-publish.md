---
id: TASK-242
title: 'Release prep: v0.6.0 (verify, changelog, local tag; do not publish)'
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-09T20:42:00Z'
labels:
  - build-release
milestone: m-1
dependencies:
  - TASK-241
  - TASK-262
  - TASK-263
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
- [x] #1 All regression cases scheduled for 0.6.0 run as normal tests and pass
- [x] #2 CHANGELOG has a [0.6.0] section with a Breaking changes subsection; package.json version is 0.6.0
- [x] #3 Annotated tag v0.6.0 is verified, authorized release PR is merged and tag pushed; verified tarball and saved release notes remain for maintainer publication, with commands and evidence recorded
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Confirm all m-1 work is Done, verify remaining failing cases belong only to v0.7, finalize the dated breaking-first CHANGELOG and version, and regenerate API docs.
2. Run full verification, commit release preparation and create the annotated tag. Verify the scratch tag worktree and both tag/branch local CI gates.
3. Push the authorized branch, create/comment/merge the release PR normally, update main and push the tag.
4. Pack/inspect/hash and smoke-test the tarball, save release notes, then close this task on main and push the backlog commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Current mission authorizes pushing release/v0.6.0 and v0.6.0, then merging the release PR with a normal merge after both local CI gates pass. This overrides the older local-tag-only wording. npm publish is maintainer-only (interactive 2FA); the agent never publishes. GitHub Actions is unavailable due to the billing lock.

- All m-1 tasks other than this prep are Done. Regression check: 24 ordinary audit cases pass; six expected failing cases remain only for A10/TASK-243, A12/TASK-245 (2), A15/TASK-246 and A17/TASK-244 (2). The README grep matches describe the convention only.
- Version 0.6.0 and dated 2026-11-09 CHANGELOG finalized, starting with Breaking changes and linking the migration guide. API documentation regenerated. Full host gate PASS: 891 pass, 2 pre-existing v0.7 skips, 0 fail; TS 7.0.2 typecheck, TS 5.9.3/6.0.3 compatibility; lint; build; type tests; isolated tarball consumer TS 6/7 and CRUD; actionlint. Docs build PASS; existing TypeDoc warnings tracked by TASK-264.
- Updated acceptance criterion 3 to reflect the mission’s explicit merge/tag-push authorization and maintainer-only publication, superseding the earlier local-only wording.

- Release PR https://github.com/g5becks/StrataDb/pull/2 merged without squash/rebase as ca2e54e655e1beb4ab7880a0da16fd58fe36e915 under the maintainer mission authorization. Tag v0.6.0 -> 09deee50a78edc1d729f91880b5cd7f9921612f5 is an ancestor of main and was pushed. The mission overrides local-tag-only wording.
- Scratch tag worktree full gate PASS (891 pass, 2 existing skips, 0 fail; typecheck, lint, build, type tests and consumer smoke); package version and dated breaking-first CHANGELOG verified.
- Both tag and release branch local CI runs PASS at 09deee50a78edc1d729f91880b5cd7f9921612f5. Results comment: https://github.com/g5becks/StrataDb/pull/2#issuecomment-6750929863.
- Tarball: /Users/takinprofit/Dev/StrataDb-release/v0.6.0/stratadb-0.6.0.tgz (40 files, allowed dist/src/README/LICENSE/package.json only); SHA-512 dcd8df8ecbd010ac85ce11d08e7afed5fc1f781025be8ab79d4ef390817227e6a9b37bb51776272fb8ce4106b8d17fed90ff9d76f7e3f7458821d30d4c2ea630. Isolated bun init/add tarball/memory insert/find/close PASS. Worktree and RELEASE_NOTES.md retained.
- npm publish pending maintainer (interactive 2FA). No publication or GitHub release was performed.

GitHub Actions unavailable (billing lock). No GitHub run is claimed.

### v0.6.0

Verified with scripts/ci-local.sh (09deee50a78edc1d729f91880b5cd7f9921612f5, PASS); GitHub Actions unavailable (billing lock).

| Job | Result |
| --- | --- |
| check (macOS, Bun 1.4.4 pinned/latest) | PASS |
| check (Linux, Bun 1.4.4 pinned/latest) | PASS |
| TypeScript 5.9.3 | PASS |
| TypeScript 6.0.3 | PASS |
| TypeScript 7.0.2 | PASS |
| TypeScript 7.1.0-beta (advisory) | PASS |

RESULT: PASS. Bun pinned=latest=1.4.4.

### release/v0.6.0

Verified with scripts/ci-local.sh (09deee50a78edc1d729f91880b5cd7f9921612f5, PASS); GitHub Actions unavailable (billing lock).

| Job | Result |
| --- | --- |
| check (macOS, Bun 1.4.4 pinned/latest) | PASS |
| check (Linux, Bun 1.4.4 pinned/latest) | PASS |
| TypeScript 5.9.3 | PASS |
| TypeScript 6.0.3 | PASS |
| TypeScript 7.0.2 | PASS |
| TypeScript 7.1.0-beta (advisory) | PASS |

RESULT: PASS. Bun pinned=latest=1.4.4.

Maintainer commands:

```bash
cd /Users/takinprofit/Dev/StrataDb-release/v0.6.0 && npm publish ./stratadb-0.6.0.tgz --access public
npm view stratadb@0.6.0 version
gh release create v0.6.0 --verify-tag --title v0.6.0 --notes-file /Users/takinprofit/Dev/StrataDb-release/v0.6.0/RELEASE_NOTES.md
```
<!-- SECTION:NOTES:END -->
