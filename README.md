# BudgetIT

A **local-first IT budgeting and reporting desktop app** built as an Electron + React (Vite) monorepo. BudgetIT runs as a Windows and Linux desktop application, stores data in an **encrypted SQLite database**, and includes workflows for budgeting scenarios, imports, reports/exports, alerts, and basic natural-language querying (NLQ).

## Project Title and Description

**BudgetIT** is a desktop budgeting app intended for tracking IT spend and contracts locally on a single machine. It uses:

* **Electron (main process)** for desktop runtime, tray/startup behavior, IPC, notifications, packaging, and running background alert checks.
* **React + Fluent UI (renderer)** for the user interface.
* **Encrypted SQLite** (via `better-sqlite3-multiple-ciphers`) plus migrations for local storage.
* A workspace-style UI with routes for **Dashboard, Expenses, Services, Contracts, Vendors, Tags/Dimensions, Scenarios, Alerts, Import, Reports, NLQ, and Settings**.

Key capabilities present in the codebase include:

* **Encrypted DB initialization + migrations** on startup.
* **Alerts** (list/ack/snooze) and periodic scheduler ticks in the background.
* **Backups** (create/restore/verify) with a manifest + health state tracking.
* **Import flows** (expense import + actuals import) with preview/commit steps.
* **Reporting + exports** (query datasets, preview reports, export report artifacts).
* **NLQ parsing** into a safe filter specification.
* **Replacement planning** data structures and queries.
* Optional **Teams Workflows webhook** alert channel (configurable via Settings).

## Installation Instructions

> This repo is a Node.js **workspaces** monorepo (`apps/*`, `packages/*`). Packaging scripts support Windows and Linux targets.

### Prerequisites

* **Node.js** (required)
* **npm** (required)
* Build environment suitable for Electron + native modules on the target OS (needed for `better-sqlite3-multiple-ciphers` and Electron packaging)

### Install

```bash
# from repo root
npm install
```

### Build

```bash
# builds packages and apps via workspace scripts
npm run build
```

### Run (development)

TODO: Add a first-class `dev` workflow.

Notes from the current codebase:

* The Electron main process checks `BUDGETIT_RENDERER_URL` and will load that URL if set; otherwise it loads the built renderer HTML from `apps/renderer/dist/index.html`.
* There is no `dev` script in the current `package.json` files, so you'll need to start a renderer dev server manually (and then set `BUDGETIT_RENDERER_URL`) or run the built artifacts.

### Package (Windows installer)

```bash
npm run dist:win
```

This runs the workspace build once, then performs per-architecture native rebuild + packaging for both `x64` and `arm64` NSIS installers under `dist/release`.

Architecture-specific packaging commands:

```bash
npm run dist:win:x64
npm run dist:win:arm64
```

### Package (Linux artifacts)

```bash
npm run dist:linux
```

This runs the workspace build once, then performs per-architecture native rebuild + packaging for both `x64` and `arm64` Linux artifacts (`AppImage` + `deb`) under `dist/release`.

Architecture-specific packaging commands:

```bash
npm run dist:linux:x64
npm run dist:linux:arm64
```

Architecture-specific native rebuild commands:

```bash
npm run rebuild:native:electron:x64
npm run rebuild:native:electron:arm64
```

Optional packaged checks:

```bash
npm run smoke:packaged:win
npm run smoke:packaged:linux
```

## Usage Examples

### Example: Build and create Windows installers (x64 + arm64)

```bash
npm install
npm run build
npm run dist:win
```

The installer output is placed under:

```text
dist/release
```

Expected installer artifacts:

```text
BudgetIT-Setup-<version>-x64.exe
BudgetIT-Setup-<version>-arm64.exe
```

### Example: Build Linux artifacts (x64 + arm64)

```bash
npm install
npm run build
npm run dist:linux
```

Expected Linux artifacts:

```text
BudgetIT-<version>-linux-x64.AppImage
BudgetIT-<version>-linux-x64.deb
BudgetIT-<version>-linux-arm64.AppImage
BudgetIT-<version>-linux-arm64.deb
```

### Example: Renderer <-> Main IPC usage (in-app)

BudgetIT exposes a restricted IPC bridge to the renderer via `preload.ts`. The renderer calls:

```ts
// In renderer code (running in the browser window):
const settings = await window.budgetit.invoke("settings.get");
await window.budgetit.invoke("backup.create", { destinationDir: "/tmp/BudgetIT-backups" });
const alerts = await window.budgetit.invoke("alerts.list");
```

Supported invoke channels are explicitly allow-listed in the preload bridge (e.g., `settings.get`, `db.open`, `backup.create`, `alerts.snooze`, `reports.query`, `export.report`, `nlq.parse`, etc.).

## Dependencies

### Root (workspace-level)

* `typescript`
* `eslint` (+ `@typescript-eslint/*`)
* `vitest`
* `electron-builder`
* `exceljs`
* `xlsx`

### `apps/desktop` (Electron main process)

* `electron`
* `exceljs`
* `xlsx`
* Internal workspace packages: `@budgetit/core`, `@budgetit/db`

### `apps/renderer` (React UI)

* `react`, `react-dom`
* `react-router-dom`
* `@fluentui/react-components`
* Dev/test: `vite`, `vitest`, Testing Library, `jsdom`, `vitest-axe`

### `packages/db` (database + domain services)

* `better-sqlite3-multiple-ciphers`
* `drizzle-orm`
* `zod`

## Configuration

### Environment variables

* `BUDGETIT_RENDERER_URL`
  If set, the Electron main process loads this URL (useful for running against a renderer dev server). If unset, it loads the built renderer HTML from `apps/renderer/dist/index.html`.

### Runtime settings (persisted)

The desktop app persists runtime settings in the user data directory (e.g., `runtime-settings.json`). Settings in the UI/tests include:

* `startWithWindows` (persisted key controlling Electron `openAtLogin`)
* `minimizeToTray`
* `teamsEnabled`
* `teamsWebhookUrl`
* `lastRestoreSummary` (restore result summary)

### Local data files (persisted)

The desktop app stores:

* Encrypted database under the app's user data directory (data subfolder)
* Secrets (DB key material) under a secrets subfolder using Electron `safeStorage`
* Backup health state (e.g., `backup-health.json`)
* Import mapping templates and auto-tag rules JSON files
* Diagnostics logs under a `logs` directory

### Backup coverage and machine-local state

Encrypted backup artifacts cover the **database-backed records** stored in the encrypted SQLite database.

Examples covered by backup:

* vendors, services, contracts, expenses, recurrences
* scenarios and scenario settings
* dimensions/tags and tag assignments
* alerts, approvals, audits, actuals review data
* reporting/reference records persisted in the database

Examples intentionally **not** covered by backup:

* runtime settings stored in `runtime-settings.json`
* backup health / verification history JSON
* import mapping templates and auto-tag rules JSON
* renderer machine-local UI state such as dashboard layout, saved report presets, NLQ history, and quick-start checklist progress

The renderer UI state above is intentionally kept machine-local because it is device/profile convenience state rather than source-of-truth business data.

After a backup restore, BudgetIT clears the renderer machine-local UI state above so restored database contents are not paired with stale local-only preferences.

### Native browse dialogs

Desktop browse dialogs are available in these workflows:

* **Settings**: choose backup destination, restore backup file, restore manifest, verify backup file, verify manifest
* **Import**: choose import source file
* **Reports**: choose export destination folders
* **NLQ**: choose export destination folder

> TODO: Add a dedicated "Data locations" section with exact resolved paths per OS, plus an explanation of how to relocate/override them if desired.

## Contribution Guidelines

Contributions are welcome.

Suggested workflow:

1. Fork the repo and create a feature branch.
2. Install deps and run the quality gates:

   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```
3. If touching packaging/release behavior, review:

   * `docs/release-hardening.md`
   * `docs/operations-runbook.md`
4. Open a PR with a clear description, screenshots for UI changes, and any operational notes.

If touching Help Center content, use the generated help workflow:

```bash
npm run help:generate
npm run help:check
```

TODO: Add `CONTRIBUTING.md` (branch naming, commit conventions, PR checklist, etc.).

## License

TODO: Add license information (no `LICENSE` file was found in the current codebase).

