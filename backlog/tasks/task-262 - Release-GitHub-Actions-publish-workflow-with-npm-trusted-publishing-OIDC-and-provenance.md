---
id: TASK-262
title: >-
  Release: GitHub Actions publish workflow with npm trusted publishing (OIDC)
  and provenance
status: Done
assignee:
  - '@codex'
created_date: '2026-11-09T17:47:00Z'
updated_date: '2026-11-09T20:34:00Z'
labels:
  - build-release
milestone: m-1
dependencies:
  - TASK-214
documentation:
  - stratadb-audit.md
priority: high
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add .github/workflows/release.yml, triggered by v* tags. Steps: checkout at the tag; setup-bun pinned by SHA; bun install --frozen-lockfile; run typecheck, lint, test, build, test:types and test:consumer; fail if the tag does not equal v${package.json version}; if npm view stratadb@<version> version already returns that version, skip publishing with a notice; otherwise bun pm pack and npm publish <tarball> --provenance --access public. Use permissions: id-token: write and contents: read, and npm trusted publishing with no NPM_TOKEN secret. Pin every action by SHA. In CONTRIBUTING.md, document the one-time npmjs.com trusted-publisher setup, the scripts/ci-local.sh fallback, and the manual publish procedure (npm publish <tarball> with interactive 2FA).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 release.yml triggers only on v* tags and pins every action by SHA
- [x] #2 The job runs the full quality gate and the consumer smoke test before publishing
- [x] #3 The job fails when the tag does not match package.json version
- [x] #4 The job skips publishing, without failing, when that version is already on npm
- [x] #5 Publishing uses OIDC trusted publishing with --provenance; no long-lived token is referenced; actionlint passes; CONTRIBUTING.md documents trusted-publisher setup, ci-local fallback and manual publishing
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a tag-only SHA-pinned OIDC release workflow with version and registry guards and the full quality gate.
2. Document npm trusted-publisher setup and the local/manual release fallback.
3. Review workflow contents, run actionlint and all host gates, then commit and verify local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Added the v*-tag-only workflow with SHA-pinned checkout/setup-bun/setup-node, Node 24 for npm OIDC, Bun 1.4.4, contents:read and id-token:write. Version mismatch fails before installation; the full quality gate and consumer test precede the registry guard and publish step.
- Exact published-version matches produce a notice and skip; only an E404 permits publication, while malformed registry responses/network errors fail. The workflow packs with Bun and requests provenance/public access through trusted publishing, with no npm secret. Publication was not executed.
- CONTRIBUTING.md documents the one-time npm publisher fields, direct-publish authorization, GitHub-hosted runner requirement, billing/local-CI fallback and maintainer-only interactive-2FA manual procedure. Setup-node v6 SHA verified against the official repository; npm requirements verified against official trusted-publisher documentation.
- Breaking change: none. Host gates PASS (882 pass, 2 existing skips, 0 fail; TS 5.9.3/6.0.3/7.0.2; lint/build/type tests/consumer). actionlint PASS; workflow contents reviewed against all acceptance criteria. Local CI pending committed SHA; GitHub execution unavailable due to billing lock.

- Verified with scripts/ci-local.sh (b569870410c9f90be15a576c753f41905764fd1f, PASS); GitHub Actions unavailable (billing lock). All macOS/Linux Bun and required/advisory TypeScript jobs passed. Workflow acceptance verified by contents and actionlint; no GitHub workflow execution or npm publication was performed.
<!-- SECTION:NOTES:END -->
