---
id: TASK-260
title: 'Release prep: v0.7.0 (verify, changelog, local tag; do not publish)'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-10T13:45:00Z'
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
  - TASK-266
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
- [x] #1 No test.failing cases remain in test/regression
- [ ] #2 CHANGELOG has a [0.7.0] section; package.json version is 0.7.0; all verification commands pass
- [ ] #3 Annotated v0.7.0 tag is verified and pushed after the authorized normal release PR merge; verified tarball path/hash and maintainer-only publish commands are recorded
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Confirm all m-2 tasks except this prep are Done, all audit regressions pass and performance evidence is recorded.
2. Finalize dated0.7.0 changelog, version and generated docs; run full release-prep verification and actionlint.
3. Commit and create annotated v0.7.0; verify in the release worktree and run local CI on both tag and release branch.
4. Push branch, open/comment release PR with CI tables, merge normally, fast-forward main and push the verified tag.
5. Build/pack/inspect tarball, record SHA512 and test an isolated tarball consumer; save release notes.
6. Close this prep on main with authorization, CI/PR/merge/tag and pending-maintainer publishing evidence, then push main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Maintainer mission authorization (2026-11-09): push release/v0.7.0, merge its release PR with --merge and push annotated v0.7.0 after tag ancestry verification. This authorization overrides TASK-260 local-tag-only wording.
- npm publishing is exclusively the maintainer's job with interactive2FA; this agent never runs npm publish/login/adduser or authentication URLs. GitHub release creation follows maintainer publication.
- Actions is unavailable due to billing; scripts/ci-local.sh is the required gate. Plan approval is pre-granted. Follow release procedure R and all mission hard rules.

- Release-prep verification PASS (2026-11-10): frozen install, docs build with zero TypeDoc warnings,1055 tests/no failures/skips,30 audit regressions passing, no expected-failure markers anywhere in test/, source/type suites TS5.9.3/6.0.3/7.0.2, lint, build, packed consumer TS6/7+CRUD, actionlint and pack dry-run (63 allowed package files). VitePress chunk-size advisory is retained.
- All m-2 implementation/follow-up tasks are Done. TASK-252/253/258 before/after raw samples and TASK-267/257 baselines are recorded. Changelog0.7.0 dated2026-11-10 starts with Breaking changes; version0.7.0. Projection release notes use the clean8.46us measurement.
- Pending: annotated tag scratch verification, both release CI refs, authorized push/PR merge/tag, final pack/SHA512 and isolated consumer. npm publish remains pending maintainer interactive2FA.
<!-- SECTION:NOTES:END -->
