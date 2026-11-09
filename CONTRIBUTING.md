# Contributing and releasing

Use Bun 1.4.4 or newer. Install with `bun install --frozen-lockfile`, then run:

```bash
bun run typecheck
bun run lint
bun test
bun run build
bun run test:types
bun run test:consumer
```

## Local CI when GitHub Actions is unavailable

The account currently has a GitHub Actions billing lock. Jobs cannot start, so
do not describe a local verification as a GitHub run. From the main checkout:

```bash
bash scripts/ci-local.sh <tag-or-branch>
bunx --bun actionlint
```

The script must print `RESULT: PASS`. It tests macOS on the host and Linux in
Docker, pinned and latest Bun, and TypeScript 5.9/6.0/7.0 with 7.1-beta advisory.
Docker/Colima must already be running. Preserve its result table and SHA in the
release PR. Update this script whenever the CI workflow's checks change.

## One-time npm trusted-publisher setup

An npm package maintainer configures this on npmjs.com in **stratadb → Settings
→ Trusted publishing**. Select GitHub Actions and enter:

| Setting | Value |
| --- | --- |
| Organization or user | `g5becks` |
| Repository | `StrataDb` |
| Workflow filename | `release.yml` |
| Environment | Leave empty (the workflow declares no environment) |

Allow direct publishing for this publisher. Review the
[npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/)
when configuring it. This requires a GitHub-hosted runner, npm 11.5.1 or newer,
and Node 22.14 or newer; the workflow selects Node 24. It uses short-lived OIDC
credentials and requests provenance, without a stored npm credential.

`.github/workflows/release.yml` runs only on pushed `v*` tags. It checks out the
tag, checks its version against package.json, and completes all checks above
before consulting the registry. An already published version is a successful
skip. Registry errors other than a missing version fail the job. Publishing
remains unavailable while Actions is locked, even after publisher setup.

## Manual publication by the maintainer

The release engineer prepares a verified tag worktree, tarball, SHA-512 digest,
and `RELEASE_NOTES.md` under `../StrataDb-release/vX.Y.Z`. Keep those artifacts.
Review the digest and archive contents (only `dist/`, `src/`, README, LICENSE,
and package.json), and verify an isolated consumer can install the tarball and
perform in-memory CRUD. The release engineer never publishes to npm.

After the release PR is merged and its tag is pushed, the maintainer runs:

```bash
cd ../StrataDb-release/vX.Y.Z
shasum -a 512 stratadb-X.Y.Z.tgz
npm publish ./stratadb-X.Y.Z.tgz --access public
npm view stratadb@X.Y.Z version
gh release create vX.Y.Z --verify-tag --title vX.Y.Z --notes-file RELEASE_NOTES.md
```

Manual npm publication requires interactive 2FA for every publish. Complete it
personally; do not give the release engineer credentials. If the automated
workflow later runs for an already published version, its registry guard skips
publication. Create the GitHub release only after verifying the npm version.
