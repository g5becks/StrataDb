---
id: TASK-262
title: >-
  Release: GitHub Actions publish workflow with npm trusted publishing (OIDC)
  and provenance
status: To Do
assignee: []
created_date: '2026-11-09T17:47:00Z'
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
- [ ] #1 release.yml triggers only on v* tags and pins every action by SHA
- [ ] #2 The job runs the full quality gate and the consumer smoke test before publishing
- [ ] #3 The job fails when the tag does not match package.json version
- [ ] #4 The job skips publishing, without failing, when that version is already on npm
- [ ] #5 Publishing uses OIDC trusted publishing with --provenance; no long-lived token is referenced; actionlint passes; CONTRIBUTING.md documents trusted-publisher setup, ci-local fallback and manual publishing
<!-- AC:END -->
