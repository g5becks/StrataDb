---
id: TASK-266
title: 'DX: align array query types with supported index and scalar element filters'
status: To Do
assignee: []
created_date: '2026-11-10T01:40:00Z'
labels:
  - api
milestone: m-2
dependencies:
  - TASK-245
  - TASK-251
documentation:
  - stratadb-audit.md
priority: medium
type: bug
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
While implementing Q4 differential coverage (TASK-251), source inspection found ArrayOperator declares $index as number although the validated runtime requires {index, condition}; scalar $elemMatch is declared QueryFilter<U>, which describes object fields instead of numeric/string element operators. Align the public types with the verified runtime and A12 element support without loosening malformed-value checks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Type tests accept $index objects with typed scalar/operator conditions and reject the obsolete numeric shorthand and malformed shapes
- [ ] #2 Type tests accept scalar numeric/string and nested object $elemMatch filters with appropriate operand types
- [ ] #3 Runtime behavior and validation remain unchanged; full quality gate and local CI pass; documentation and CHANGELOG identify the corrected types
<!-- AC:END -->
