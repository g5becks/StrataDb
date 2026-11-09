# Documentation toolchain

The private docs package pins TypeScript 6 because TypeDoc 0.28 uses the classic
compiler API, which TypeScript 7.0 does not provide. The library uses TypeScript 7.

Install both packages with `bun install` and `bun install --cwd docs`, then run
`bun run docs:build` from the repository root to regenerate `docs/api` and build
VitePress. `bun run docs:dev` also regenerates API pages before starting the server.

Tracking: remove this separate compiler/package once TypeDoc supports the stable
TypeScript 7 compiler API. Recheck this workaround when adopting TypeScript 7.1.
