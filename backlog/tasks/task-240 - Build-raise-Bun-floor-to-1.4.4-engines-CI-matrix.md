---
id: TASK-240
title: 'Build: raise Bun floor to >=1.4.4 (engines + CI matrix)'
status: To Do
assignee: []
created_date: '2026-11-09T04:01:00Z'
labels:
  - build-release
milestone: m-1
dependencies:
  - TASK-227
documentation:
  - stratadb-audit.md
priority: medium
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Decision baked in from audit 1B-B4: StrataDB 0.6.0 requires Bun >= 1.4.4. That release has update hooks and UDFs, the ALTER TABLE stale-statement fix needed for schema evolution, correct `changes` counts, SQLITE_ERROR codes and the rejected-promise transaction fix. agentx upgrades Bun 1.3.14 → 1.4.4 in the same window. If the maintainer prefers >=1.3.14, change this task before starting it.

## Implementation
1. `engines.bun` ">=1.4.4".
2. CI Bun matrix: floor 1.4.4 + latest.
3. Remove compatibility fallbacks that only exist for Bun < 1.4.4 (none expected; check).
4. README Installation section: state the requirement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 package.json engines.bun is >=1.4.4 and README states the requirement
- [ ] #2 CI tests on Bun 1.4.4 and the latest Bun
- [ ] #3 CHANGELOG.md has an entry under ## [Unreleased] describing the change (Breaking changes section)
<!-- AC:END -->
