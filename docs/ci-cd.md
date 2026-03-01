# CI/CD Pipelines

This repository now includes two GitHub Actions workflows:

- `CI`: `.github/workflows/ci.yml`
- `Release (Windows)`: `.github/workflows/release.yml`

## Local Prerequisites

- Node 22 is required (see `.nvmrc` and root `package.json` `engines`).
- After `npm ci`, rebuild native SQLite bindings for local Node before DB/desktop tests:
  - `npm run rebuild:native:node`
- For installer packaging, rebuild for Electron:
  - `npm run rebuild:native:electron -- --arch=x64`
  - `npm run rebuild:native:electron -- --arch=arm64`
  - or run `npm run dist:win` to build/rebuild/package both architectures.

## CI workflow

Triggers:

- Pull requests to `main`
- Pushes to `main`
- Manual runs (`workflow_dispatch`)

Behavior:

- If `package.json` is missing, the workflow reports scaffold-pending and skips quality checks.
- If `package.json` exists, CI requires these npm scripts:
  - `lint`
  - `typecheck`
  - `test`
  - `build`
- Runs on `windows-latest` and uploads optional test artifacts (`coverage`, `junit.xml`, `test-results`).
- Builds Windows NSIS artifacts for `x64` and `arm64` in a follow-up smoke job and runs `npm run smoke:packaged`.

## Release workflow (CD)

Triggers:

- Push tag matching `v*` (example: `v0.1.0`)
- Manual run with required `tag` input (must already exist)

Behavior:

- Validates tag and project scaffold.
- Ensures pushed tag commit is contained in `origin/main`.
- Runs quality gates (`lint`, `typecheck`, `test`, `build`) before packaging.
- Runs packaged smoke checks (`npm run smoke:packaged`) after artifact creation.
- Resolves packaging script from the first existing script in:
  - `release:win`
  - `dist:win`
  - `package:win`
  - `dist`
- Builds Windows artifacts for `x64` and `arm64`, generates `SHA256SUMS.txt`, uploads artifacts, and publishes GitHub Release notes automatically.

## Required repository settings

Recommended branch protections for `main`:

- Require status check: `Lint, Typecheck, Test, Build`
- Require pull request before merge
- Restrict direct pushes

## Optional secrets for code signing

If you sign release binaries with `electron-builder`, configure one of these secret pairs:

- `CSC_LINK` and `CSC_KEY_PASSWORD`
- `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`

If no signing secrets are provided, the release workflow still runs but unsigned artifacts are produced.

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
    "smoke:packaged": "..."
  }
}
```

`release:win` can be replaced by `dist:win`, `package:win`, or `dist`.
