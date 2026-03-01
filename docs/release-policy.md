# Windows Release Policy

This project publishes Windows `x64` and `arm64` installers for both continuous `main` pushes and semantic version tags (`vX.Y.Z`).

## Versioning

- Source of truth is the Git tag (`v0.1.0`, `v1.2.3`, etc.).
- Release workflow is triggered by:
  - Pushes to `main` (publishes prerelease with auto tag `main-<shortsha>`)
  - Pushes of `v*` tags
  - Manual dispatch with an existing tag
- Tagged/manual GitHub Release title format: `BudgetIT vX.Y.Z`.
- Main push prerelease title format: `BudgetIT main <shortsha>`.
- Installer/package version behavior:
  - Tagged/manual release: `package.json` version is set to the tag version (for example `v0.2.0 -> 0.2.0`).
  - Main push prerelease: version is derived as `<baseVersion>-main.<runNumber>.<shortsha>` (example: `0.2.0-main.128.a1b2c3d`).

## Artifact naming

Configured in `electron-builder.yml`:

- Generic artifact pattern: `BudgetIT-${version}-win-${arch}.${ext}`
- NSIS installer pattern: `BudgetIT-Setup-${version}-${arch}.${ext}`
- Output folder: `dist/release`
- Required installer artifacts per release:
  - `BudgetIT-Setup-${version}-x64.exe`
  - `BudgetIT-Setup-${version}-arm64.exe`

## Packaging commands

- `npm run dist:win` builds and packages both architectures sequentially.
- `npm run dist:win:x64` packages only the x64 installer.
- `npm run dist:win:arm64` packages only the ARM64 installer.

## Installer defaults

Installer and runtime behavior defaults:

- NSIS target with user-selectable install directory (`oneClick: false`).
- Desktop shortcut creation enabled.
- Runtime default settings are persisted in app settings:
  - `startWithWindows = true`
  - `minimizeToTray = true`
- Users can change runtime defaults in the app settings page.

## Validation gates

- CI pull request workflow runs:
  - lint
  - typecheck
  - tests
  - build
  - NSIS packaging smoke check (x64 + arm64 installers exist)
- Release workflow re-runs quality gates and generates release checksums (`SHA256SUMS.txt`).

