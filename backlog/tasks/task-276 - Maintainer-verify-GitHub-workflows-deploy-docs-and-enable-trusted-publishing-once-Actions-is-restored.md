---
id: TASK-276
title: >-
  Maintainer: verify GitHub workflows, deploy docs and enable trusted publishing
  once Actions is restored
status: To Do
assignee:
  - '@takinprofit'
created_date: '2026-11-10T16:03:00Z'
labels:
  - blocked-external
  - maintainer
dependencies: []
priority: medium
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
GitHub Actions has been unavailable since 2026-11-09 (account billing lock). Everything below needs the maintainer and Actions. An agent can't do it.

## Steps (maintainer)
1. Resolve the billing lock, and fix the Renovate setup that used up the minutes before re-enabling anything.
2. Run `ci.yml` once with workflow_dispatch on main, and confirm both OSes and the TypeScript matrix pass on GitHub.
3. Run `deploy-docs.yml` (workflow_dispatch) so GitHub Pages shows the docs for 0.6+. The site still shows 0.5.0, including the outdated semantics.
4. Configure npm trusted publishing for `stratadb` (CONTRIBUTING.md) and confirm `release.yml` skips already-published versions.
5. Check the scheduled workflows (`benchmarks.yml` weekly, `query-properties.yml` nightly) on their first runs.
6. Optional: delete the merged remote branches `release/v0.5.1`, `release/v0.6.0` and `release/v0.7.0`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ci.yml passes on GitHub for all matrix entries
- [ ] #2 Docs site deployed from main and shows 0.6+ semantics and the migration guide
- [ ] #3 npm trusted publishing configured; release.yml verified on the next tag (publishes or skips correctly)
- [ ] #4 Scheduled benchmark and property workflows have each completed one run
<!-- AC:END -->
