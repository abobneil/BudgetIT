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

## CI workflow

Triggers:

- Pull requests to `main`
- Pushes to `main`
- Manual runs (`workflow_dispatch`)

Behavior:

- Runs quality gates (`lint`, `typecheck`, `test`, `build`) on `windows-latest`.
- Runs packaging smoke jobs after quality:
  - Windows (`dist:win`, smoke checks, artifact validation)
  - Linux x64 (`dist:linux:x64`, smoke checks, artifact validation)
  - Linux arm64 (`dist:linux:arm64`, smoke checks, artifact validation) on self-hosted ARM64 runner labels: `self-hosted`, `linux`, `arm64`
- Uploads platform-scoped artifacts from each packaging smoke job.

## Release workflow (CD)

Triggers:

- Successful completion of `CI` for pushes to `main` (publishes/updates release `main-latest`)
- Push tag matching `v*` (example: `v0.1.0`)
- Manual run with required `tag` input (must already exist)

Behavior:

- Resolves release metadata by trigger type.
- Runs quality gates once before packaging.
- Builds release artifacts in parallel jobs:
  - Windows (`release:win`)
  - Linux x64 (`release:linux -- --arch=x64`)
  - Linux arm64 (`release:linux -- --arch=arm64`)
- Runs platform-scoped packaged smoke checks in each packaging job.
- Aggregates all artifacts, generates `dist/release/SHA256SUMS.txt`, and publishes a single GitHub release.

## Required repository settings

Recommended branch protections for `main`:

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
