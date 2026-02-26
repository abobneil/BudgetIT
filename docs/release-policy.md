# Windows Release Policy

This project publishes Windows installers from semantic version tags (`vX.Y.Z`).

## Versioning

- Source of truth is the Git tag (`v0.1.0`, `v1.2.3`, etc.).
- Release workflow is triggered on push of `v*` tags or manual dispatch with an existing tag.
- GitHub Release title format: `BudgetIT vX.Y.Z`.

## Artifact naming

Configured in `electron-builder.yml`:

- Generic artifact pattern: `BudgetIT-${version}-win-${arch}.${ext}`
- NSIS installer pattern: `BudgetIT-Setup-${version}-${arch}.${ext}`
- Output folder: `dist/release`

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
  - NSIS packaging smoke check (artifact exists)
- Release workflow re-runs quality gates and generates release checksums (`SHA256SUMS.txt`).

