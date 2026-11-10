---
id: TASK-250
title: 'Feature: read-only database mode'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-09T04:01:00Z'
updated_date: '2026-11-10T01:29:00Z'
labels:
  - api
milestone: m-2
dependencies:
  - TASK-242
documentation:
  - stratadb-audit.md
priority: low
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
agentx's reference DB relies on DDL being a no-op against a read-only file. Bun 1.4.4 rejects `{ readonly: true, create: true }`. Audit refs: A22, 1B-B1.

## Implementation
1. `new Strata({ database: path, readonly: true })` opens with `{ readonly: true }` only.
2. In read-only mode, skip all DDL and reject every write method with a typed error (e.g. ConnectionError "database is read-only").
3. Tests with a temp file DB.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 readonly: true opens an existing file without running DDL and all reads work (test)
- [x] #2 Every write method rejects with a typed read-only error (test)
- [ ] #3 bun test, bun run typecheck, bun run lint and bun run build all pass locally and in CI
- [x] #4 CHANGELOG.md has an entry under ## [Unreleased] describing the change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add real file-backed read-only open/read/transaction and every-write rejection regressions, including no-DDL instrumentation and missing-file safety.
2. Open paths with Bun readonly:true alone, track read-only policy, skip collection DDL while validating stored columns, reject writes centrally with a typed nonretryable error, and permit read transactions.
3. Document native-connection semantics and schema prerequisites, then run all host gates and local CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- readonly:true opens a file using Bun readonly:true alone, never create:true. The file must exist. Read-only collection setup validates required storage/indexed columns and drift policy through PRAGMA without running CREATE/ALTER/DROP or cache-mutating DDL. Missing tables/columns reject with SchemaValidationError and a writable-migration remedy.
- Read-only policy is tracked per native connection and enforced centrally for all 11 write operations. It rejects with DatabaseError (sqliteCode 8, read-only message), which the default retry classifier does not retry; custom predicates retain precedence. Closed-database errors keep their existing priority/promise behavior. Existing deferred transactions already support read callbacks and required no transaction-manager change. Supplied native connections retain native access behavior; opening them physically read-only is the caller’s responsibility.
- Regression-first: all four initial real-file cases failed before implementation. Final six cases verify reads and manual/execute read transactions, no-DDL instrumentation, physical native write rejection, byte-for-byte unchanged files, all 11 promise-returning write rejections with exactly one default-policy attempt and no events, missing-file noncreation, missing-column/table errors, fluent/supplied connections and drift callback/error modes.
- Breaking change: none; new opt-in behavior. Documented connection scope, schema prerequisites, typed error and native access in CHANGELOG/collection guide. Host gate PASS: 992 pass, 1 existing projection skip, 0 fail; TS 7.0.2 typecheck; lint; build; type tests; consumer TS 6/7 CRUD; source TS 5.9.3/6.0.3. Local CI pending committed SHA.
<!-- SECTION:NOTES:END -->
