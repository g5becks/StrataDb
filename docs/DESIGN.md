# StrataDB architecture

This is the current implementation design. The audit and Backlog acceptance
criteria define remaining work. Earlier proposals are retained as
[design history](design/initial-proposal.md); their API sketches are historical.
Public contracts are generated in the [API reference](api/index.md).

## Runtime and storage

StrataDB targets Bun >=1.4.4 and SQLite >=3.45 for JSONB. Each collection is a
table with `_id` as primary key, user data in JSONB `body`, and authoritative
`createdAt`/`updatedAt` metadata columns. Timestamp visibility is a schema option;
internal timestamps remain available for writes. Circular/non-serializable JSON
rejects with `ValidationError`.

Indexed fields use virtual generated columns. Compound indexes include all
specified fields, including dotted paths. Reopening a collection adds missing
indexed columns and indexes atomically. Removed/type-changed columns remain and
are reported through `onSchemaDrift`; destructive migrations are explicit.
Read-only connections validate stored schemas without DDL.

## Construction and module boundaries

`Strata` owns a connection and caches collections by name and normalized schema
signature. Fluent builders and direct construction use the same factory.
Conflicting schemas reject; validator function identity is significant. Checked
field/index methods accept document paths. Explicit unchecked methods support
dynamic names and retain runtime identifier validation.

| Module | Responsibility |
| --- | --- |
| `stratadb.ts` | Connection lifecycle, factories and transaction handles |
| `collection-core.ts` | Shared state, retry boundary, atomic helpers and event lifecycle |
| `collection-ddl.ts` / `schema-evolution.ts` | Table/index creation and additive evolution |
| `collection-read-ops.ts` / `projection-sql.ts` | Reads, ordered cursors, search and projection |
| `collection-write-ops.ts` / `sqlite-collection.ts` | Single writes, batch writes and administration |
| `query-translation-cache.ts` / `query-operators.ts` / `sqlite-query-translator.ts` | Shape caching, operators and options |
| `field-resolver.ts` / `query-validation.ts` | Identifier/path validation and bound SQL values |
| `sqlite-boundary.ts` / `statement-cache.ts` | Error mapping and prepared-statement LRU |
| `transaction-manager.ts` | Serialization, savepoints and commit-buffered events |
| `collection-events.ts` / `collection-listeners.ts` | Typed event dispatch and listener isolation |
| `sqlite-regex.ts` / `raw-changes.ts` | Regex UDF and opt-in row-hook observer |

Public collection contracts are split into read/write/batch/events/admin types.
A short internal inheritance chain shares state and direct method dispatch
without wrapping every hot read in another call.

## Query and write semantics

Filters validate before cache lookup or execution. Unknown operators, malformed
values, unsafe paths and invalid numeric options reject. The field resolver
quotes identifiers and binds values and JSON paths. Literal projection property
names are distinct from dotted query paths.

Null/missing equality and negation follow explicit rules. LIKE-family operators
escape literals; `$like` is case-sensitive and `$ilike` folds ASCII. `$regex`
accepts a JavaScript Unicode pattern string through a deterministic UDF and is
non-indexable. `$elemMatch` keeps all conditions on one element. See the
[semantics guide](guide/mongodb-differences.md) for exact rules.

Sorted reads append `_id` unless explicitly sorted. Cursors compare every sort
key with explicit null ordering and reject unknown boundaries. `before` selects
the nearest preceding page. Inclusion projections construct selected JSON in
SQLite; exclusion projections filter hydrated documents in JavaScript.

Plain updates deep-merge objects and replace arrays. Atomic `$set`, `$unset`,
`$inc`, `$push` and `$pull` validate disjoint mutable paths, preserve metadata and
use one JSONB UPDATE per operation. Mixed forms and invalid targets reject.
Single-row read/modify/write operations use synchronous SQLite transactions.
RETURNING rows determine actual IDs and counts, including trigger effects.

## Transactions, events and errors

The connection-local manager serializes root asynchronous execution, uses
savepoints for nesting and buffers collection events until commit. Rollback
suppresses buffered events. Real Promise.all tests exercise SQLite interleavings.
Applications can use `execute()` or explicit transaction handles.

Public asynchronous operations reject through their promises. A single SQLite
boundary maps numeric errno to typed errors and preserves native cause/context.
Retries are opt-in; enabled retries default to transient SQLite errors. p-retry
callbacks use consume/failure/retry order and expose `retryDelay`.

Collection listeners run independently. Exceptions or rejected listener promises
cannot fail committed writes. Delete/many payloads identify actual rows.
Optional `onRawChange` reports connection-local row metadata before commit,
including changes later rolled back; SQLite omissions and reentrant-use limits
apply. It is separate from collection events. See [events](guide/events.md).

## Performance, verification and releases

Prepared statements use a bounded per-collection LRU, default64, finalized on
eviction/DDL/drop/close. Retained wrappers reprepare after invalidation. Query
translation caching remains opt-in. Fixed protocols in `bench/` retain before/after
numbers; the [performance guide](guide/performance.md) describes measured gains.

The host gate checks types, lint, tests, build, type assertions and a packed
consumer with TypeScript6/7 and CRUD. `scripts/ci-local.sh` mirrors macOS/Linux,
pinned/latest Bun and TypeScript5.9/6.0/7.0; 7.1-beta is advisory. Actions is
currently billing-locked, so local PASS evidence is recorded explicitly.
Workflow files also require actionlint.

Build outputs stay `dist/index.mjs` and `dist/index.d.mts`. TypeDoc uses the
separate TypeScript6 docs workspace. Agents prepare verified tarballs; the
maintainer performs interactive publishing. Repository
[contributing instructions](https://github.com/g5becks/StrataDb/blob/main/CONTRIBUTING.md)
describe trusted-publisher setup and manual release steps.
