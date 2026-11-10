# StrataDB instructions for Copilot

Follow [AGENTS.md](../AGENTS.md) for Backlog CLI usage, project behavior and
verification. Use Bun >=1.4.4, TypeScript7.0 and `bun:sqlite`; public consumers
import `Strata`, `createSchema` and document types from `stratadb`.

Use [the current architecture](../docs/DESIGN.md), API reference and guides.
Historical proposals under `docs/design/` do not define current APIs. Documents
use `_id` and JSONB body storage. Checked schema fields accept typed paths.
Plain updates merge; atomic operators use validated disjoint paths. Unknown
query operators reject, regex operands are strings, and literal LIKE-family
escaping, null/missing behavior and stable cursor order must be preserved.
Nested transactions use savepoints and serialize execution; collection events
buffer until commit and isolate listener exceptions. Raw row observers have
separate SQLite hook semantics. Read-only collections perform no DDL.

Add a regression before a behavior fix; test with real SQLite. Never weaken
tests or sort object keys automatically. Keep source modules below about600
lines and run the host quality gate, required local CI and actionlint for
workflow changes. Mirror ci.yml changes in ci-local.sh in the same commit.
Use `bunx backlog` to update task metadata. Actions is billing-locked; report
local CI honestly. Agents prepare tarballs; the maintainer publishes and handles
interactive authentication.
