# CI/CD Pipelines

This repository includes two GitHub Actions workflows:

- `CI`: `.github/workflows/ci.yml`
- `Release (Windows + Linux)`: `.github/workflows/release.yml`

## Local Prerequisites

- Node 22 is required (see `.nvmrc` and root `package.json` `engines`).
- After `npm ci`, rebuild native SQLite bindings for local Node before DB/desktop tests:
  - `npm run rebuild:native:node`
- For packaged Electron artifacts:
  - Windows: `npm run dist:win`
  - Linux: `npm run dist:linux`
  - Single-arch Linux builds: `npm run dist:linux -- --arch=x64` or `npm run dist:linux -- --arch=arm64`

## Local Prerequisites

- Node 22 is required (see `.nvmrc` and root `package.json` `engines`).
- After `npm ci`, rebuild native SQLite bindings for local Node before DB/desktop tests:
  - `npm run rebuild:native:node`
- For installer packaging, rebuild for Electron:
  - `npm run rebuild:native:electron`

## CI workflow

Triggers:

- Pull requests to `main`
- Pushes to `main`
- Manual runs (`workflow_dispatch`)

Behavior:

- Runs a dedicated help integrity job (`help:check`) on `windows-latest`.
- Runs quality gates on `windows-latest`, including `help:check`, `lint`, `typecheck`, `test`, and `build`.
- Runs packaging smoke jobs after quality:
  - Windows (`dist:win`, smoke checks, artifact validation)
  - Linux x64 (`dist:linux:x64`, smoke checks, artifact validation)
  - Linux arm64 (`dist:linux:arm64`, smoke checks, artifact validation) on GitHub-hosted ARM runner `ubuntu-24.04-arm`
- Uploads platform-scoped artifacts from each packaging smoke job.

## Release workflow (CD)

Triggers:

- Successful completion of `CI` for pushes to `main` (publishes/updates release `main-latest`)
- Push tag matching `v*` (example: `v0.1.0`)
- Manual run with required `tag` input (must already exist)

Behavior:

- Resolves release metadata by trigger type.
- Runs quality gates once before packaging, including `help:check`.
- Builds release artifacts in parallel jobs:
  - Windows (`release:win`)
  - Linux x64 (`release:linux -- --arch=x64`)
  - Linux arm64 (`release:linux -- --arch=arm64`) on GitHub-hosted ARM runner `ubuntu-24.04-arm`
- Runs platform-scoped packaged smoke checks in each packaging job.
- Aggregates all artifacts, generates `dist/release/SHA256SUMS.txt`, and publishes a single GitHub release.

## Required repository settings

Recommended branch protections for `main`:

- Require status check: `Help Integrity`
- Require status check: `Lint, Typecheck, Test, Build`
- Require pull request before merge
- Restrict direct pushes

## Optional secrets for code signing

If you sign release binaries with `electron-builder`, configure one of these secret pairs:

- `CSC_LINK` and `CSC_KEY_PASSWORD`
- `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`

If no signing secrets are provided, unsigned artifacts are still produced.

## Expected npm scripts

At minimum:

```json
{
  "scripts": {
    "help:generate": "...",
    "help:new-topic": "...",
    "help:check": "...",
    "lint": "...",
    "typecheck": "...",
    "test": "...",
    "build": "...",
    "release:win": "...",
    "release:linux": "...",
    "smoke:packaged:win": "...",
    "smoke:packaged:linux": "..."
  }
}
```

## Help Authoring Workflow

Help content now has a generated pipeline:

- Source of truth:
  - `docs/help/help-topics.json`
  - `docs/help/topics/*.md`
  - `docs/help/intro.md`
  - `docs/help/appendices/*.md`
- Generated outputs:
  - `docs/help-system.md`
  - `apps/renderer/src/features/help/help-topics.ts`

Commands:

```bash
npm run help:generate
npm run help:check
npm run help:new-topic -- --id my-topic --title "My Topic"
```

CI fails if:

- any help topic maps to a missing heading,
- orphan topic files exist in `docs/help/topics`,
- generated outputs are stale compared to source files.
