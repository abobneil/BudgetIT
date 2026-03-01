# Multi-Platform Release Policy

This project publishes Windows and Linux artifacts for `x64` and `arm64` on both continuous `main` pushes and semantic version tags (`vX.Y.Z`).

## Versioning

- Source of truth is the Git tag (`v0.1.0`, `v1.2.3`, etc.).
- Release workflow is triggered by:
  - Successful `CI` workflow completion for pushes to `main` (publishes/updates release tag `main-latest`)
  - Pushes of `v*` tags
  - Manual dispatch with an existing tag
- Tagged/manual GitHub Release title format: `BudgetIT vX.Y.Z`.
- Main push release title format: `BudgetIT main latest (v<buildVersion>)`.
- Installer/package version behavior:
  - Tagged/manual release: `package.json` version is set to the tag version (for example `v0.2.0 -> 0.2.0`).
  - Main push release: version is derived as `<baseVersion>-main.<runNumber>.<shortsha>`.

## Artifact naming

Configured in `electron-builder.yml`:

- Windows installer pattern: `BudgetIT-Setup-${version}-${arch}.exe`
- Linux artifact pattern: `BudgetIT-${version}-linux-${arch}.AppImage`
- Linux package pattern: `BudgetIT-${version}-linux-${arch}.deb`
- Output folder: `dist/release`

Required artifacts per release:

- `BudgetIT-Setup-${version}-x64.exe`
- `BudgetIT-Setup-${version}-arm64.exe`
- `BudgetIT-${version}-linux-x64.AppImage`
- `BudgetIT-${version}-linux-x64.deb`
- `BudgetIT-${version}-linux-arm64.AppImage`
- `BudgetIT-${version}-linux-arm64.deb`

## Packaging commands

- Windows:
  - `npm run dist:win`
  - `npm run dist:win:x64`
  - `npm run dist:win:arm64`
- Linux:
  - `npm run dist:linux`
  - `npm run dist:linux:x64`
  - `npm run dist:linux:arm64`

## Runtime defaults

Runtime settings defaults are persisted in app settings:

- `startWithWindows = true` (persisted key name retained for compatibility)
- `minimizeToTray = true`

UI copy for startup is platform-neutral: `Start on system login`.

## Validation gates

- CI pull request workflow runs:
  - lint
  - typecheck
  - tests
  - build
  - packaging smoke checks for Windows x64/arm64 and Linux x64/arm64
- Release workflow re-runs quality gates, builds all platform artifacts, and generates `SHA256SUMS.txt`.
