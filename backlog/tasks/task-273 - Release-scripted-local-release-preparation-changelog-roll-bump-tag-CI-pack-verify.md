---
id: TASK-273
title: >-
  Release: scripted local release preparation (changelog roll, bump, tag, CI,
  pack, verify)
status: Done
assignee:
  - '@codex'
created_date: '2026-11-10T16:03:00Z'
updated_date: '2026-11-10T16:18:00Z'
labels:
  - build-release
milestone: m-3
dependencies: []
priority: medium
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Releases v0.5.1-v0.7.0 were prepared by hand, three times over: roll `[Unreleased]` into a dated CHANGELOG section, bump the version, tag, run local CI on the tag, pack, check the tarball, write release notes. The audit (C10) suggested changesets or release-please. Both depend on GitHub Actions, which is unavailable (billing lock), and npm now requires interactive 2FA or trusted publishing. A local, deterministic script fits the current workflow and can later be called from release.yml.

## Implementation
Add `scripts/release.ts` (Bun), run as `bun run release:prepare <version>`. Steps:
1. Preflight:
   - the working tree is clean and on a `release/v<version>` branch;
   - the version is greater than the current one and its tag doesn't exist;
   - `[Unreleased]` isn't empty.
2. Move the `[Unreleased]` entries into `## [<version>] - <today>` and leave an empty `[Unreleased]`. Bump the version in `package.json`.
3. Commit `chore(release): prepare v<version>` (hooks run) and create the annotated tag `v<version>`.
4. Run `bash scripts/ci-local.sh v<version>`, then in a worktree at `/Users/takinprofit/Dev/StrataDb-release/v<version>` (configurable with `--out`):
   - frozen install and build;
   - `bun pm pack`;
   - the file-list check (only dist/, src/, README, LICENSE, package.json);
   - SHA-512 of the tarball;
   - an isolated consumer install and CRUD smoke test;
   - write `RELEASE_NOTES.md` from the CHANGELOG section.
5. Print the maintainer's publish commands. **Never push, publish, or create a GitHub release.**
6. Support `--dry-run`, which runs the preflight and prints the planned changes without writing anything.

Document the script in CONTRIBUTING.md, next to the manual procedure and the trusted-publishing notes. Record in the notes why changesets/release-please weren't chosen (they need Actions, and a single maintainer doesn't need changeset files).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 bun run release:prepare <version> --dry-run reports the planned changes and writes nothing; preflight failures exit non-zero with a clear message
- [x] #2 A real run produces the release commit, annotated tag, ci-local PASS, tarball, SHA-512 and RELEASE_NOTES.md, and prints publish commands
- [x] #3 The script never pushes, publishes, or creates GitHub releases (asserted by tests or code review notes)
- [x] #4 Tested against a temporary clone, including the CHANGELOG roll and version-bump edge cases
- [x] #5 CONTRIBUTING.md documents the script; the decision versus changesets/release-please is recorded in notes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add temporary-clone regressions for dry-run, preflight failures, changelog/version edge cases, real artifacts and failed CI.
2. Implement a Bun release command with clean release-branch preflight, stable version bump/changelog roll, hooked commit, annotated tag, strict local CI, worktree pack/digest/archive checks and isolated CRUD.
3. Document the local workflow and Actions-related tooling decision; run quality gates, clone integration and ci-local, then record verified evidence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Outcome: release:prepare performs clean-branch/stable-version/tag/changelog/output preflight, hooked release commit, annotated tag, strict ci-local gate, retained worktree, frozen build/pack, archive allowlist and required-export validation, SHA512SUMS, isolated tarball CRUD and release notes. Dry-run has no writes.
- Breaking change: none.
- Verification: five TASK-273 regressions (48 assertions) pass, including a real temporary-clone release with commit-hook evidence, annotated tag, version/changelog roll, digest and consumer, dry-run immutability, invalid versions/branches/tags/outputs, archive rejection and failed-CI stop. Clone tests use a minimal CI fixture to avoid recursion; the actual full matrix ran separately. Full suite 1162 pass; required gates and TS 5.9.3/6.0.3 passed. Verified with scripts/ci-local.sh (18379d7, PASS); GitHub Actions unavailable (billing lock). Actual v0.8.0 tag execution follows in TASK-274.
- Decisions: Bun script avoids Actions-dependent release-please/changesets automation and unnecessary per-change files for one maintainer. Code review audited every subprocess: only local git, CI, install/build/pack, archive listing and consumer run; publication and GitHub-release commands are printed text only. No push/publish/GitHub release is executed. Existing tags/output paths are never overwritten; failures preserve evidence and stop.
- Benchmarks: not applicable (release tooling).
<!-- SECTION:NOTES:END -->
