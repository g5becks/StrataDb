---
id: TASK-247
title: 'DX: type-check schema field names and compound index fields'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-10T00:58:00Z'
labels:
  - api
milestone: m-2
dependencies:
  - TASK-242
documentation:
  - stratadb-audit.md
priority: low
type: enhancement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
`field<K extends keyof T | string>()` accepts any string, so typos compile. The same applies to compoundIndex fields. Audit ref: A20.

## Implementation
Constrain names to `keyof T | DocumentPath<T>` (the Paths helper already exists), keep an explicit escape hatch (e.g. `fieldUnchecked()`), and add type tests for valid paths, invalid names and nested paths.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 createSchema<T>().field("typo") fails to compile while valid top-level and dotted paths compile (type tests)
- [x] #2 An escape hatch for untyped fields exists and is documented
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add negative and positive schema/builder field-name and compound-index type assertions before tightening names.
2. Constrain checked names to document string keys and dotted DocumentPath values, with explicit fieldUnchecked and compoundIndexUnchecked escapes that retain runtime identifier validation.
3. Document the type-level breaking change and escape hatches, then run the full host/TypeScript compatibility gate.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Checked schema and collection-builder field names and compound-index fields now use exported SchemaFieldName<T> (string document keys plus DocumentPath<T>). Optional dotted paths work in both creation styles. Existing top-level collection-builder SQL type/default inference remains intact.
- Added fieldUnchecked and compoundIndexUnchecked on both builders for dynamic metadata; they share the original registration logic and still pass through FieldResolver validation on collection creation. Exported FieldDefinitionOptions for the explicit escape API.
- Regression-first type tests reported unused negative assertions for misspelled/nested/dynamic schema names, missing escape APIs, and rejected valid nested builder paths before implementation; all now pass. Runtime tests verify dynamic indexed/compound fields in both styles and reject an injected unchecked path.
- Breaking change: dynamic or misspelled checked names no longer compile. Use explicit unchecked methods only for intentional runtime names; documented migration and examples in CHANGELOG/schema guide.
- Host gate PASS: 962 pass, 1 existing projection skip, 0 fail; TS 7.0.2 typecheck, lint, build, type tests, consumer TS 6/7 CRUD, source TS 5.9.3/6.0.3. Local CI pending committed SHA.
<!-- SECTION:NOTES:END -->
