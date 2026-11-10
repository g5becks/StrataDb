# StrataDB instructions for Claude

Follow [AGENTS.md](AGENTS.md) for project behavior, Backlog CLI management and
verification. Use Bun >=1.4.4 and the public `Strata`/`createSchema` API.

The current architecture is [docs/DESIGN.md](docs/DESIGN.md). Historical
proposals under `docs/design/` are retained for context, not current contracts.
All operations reject through promises; atomic writes and savepoint transactions
preserve data and buffer collection events until commit. Listener failures are
isolated. `$regex` takes a string pattern; timestamps(false), null/missing rules,
stable cursors and read-only behavior follow the current guides and source.

Use `bunx backlog` exclusively for tasks. Add regressions before fixes and run
the full host gate and required local CI. Workflows require actionlint. Do not
claim GitHub checks while Actions is billing-locked. Prepare verified tarballs;
leave publishing and interactive authentication to the maintainer.
