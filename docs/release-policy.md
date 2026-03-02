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

Build outputs are produced by `electron-builder` with versioned names, then normalized by the release workflow before publish.

Published release asset names:

- `BudgetIT-windows-x64-latest.exe`
- `BudgetIT-windows-arm64-latest.exe`
- `BudgetIT-linux-x64-latest.AppImage`
- `BudgetIT-linux-x64-latest.deb`
- `BudgetIT-linux-arm64-latest.AppImage`
- `BudgetIT-linux-arm64-latest.deb`

Required artifacts per release:

- `BudgetIT-windows-x64-latest.exe`
- `BudgetIT-windows-arm64-latest.exe`
- `BudgetIT-linux-x64-latest.AppImage`
- `BudgetIT-linux-x64-latest.deb`
- `BudgetIT-linux-arm64-latest.AppImage`
- `BudgetIT-linux-arm64-latest.deb`

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
