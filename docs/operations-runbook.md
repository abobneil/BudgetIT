# BudgetIT Operator Runbook

This runbook is for single-device operation of BudgetIT on Windows and Linux.

## Local Toolchain Baseline

1. Use Node 22 (`.nvmrc` is pinned to `22`).
2. Install dependencies with `npm ci`.
3. Rebuild the local Node native module before running DB/desktop tests:
   - `npm run rebuild:native:node`
4. Run local quality checks:
   - `npm run test --workspace @budgetit/db`
   - `npm run test --workspace @budgetit/desktop`
   - `npm run test --workspace @budgetit/renderer`
5. Rebuild native module for packaged Electron artifacts when releasing:
   - `npm run rebuild:native:electron -- --arch=x64`
   - `npm run rebuild:native:electron -- --arch=arm64`
6. Package release artifacts:
   - Windows: `npm run dist:win`
   - Linux: `npm run dist:linux`

## Local Toolchain Baseline

1. Use Node 22 (`.nvmrc` is pinned to `22`).
2. Install dependencies with `npm ci`.
3. Rebuild the local Node native module before running DB/desktop tests:
   - `npm run rebuild:native:node`
4. Run local quality checks:
   - `npm run test --workspace @budgetit/db`
   - `npm run test --workspace @budgetit/desktop`
   - `npm run test --workspace @budgetit/renderer`
5. Rebuild native module for packaged Electron artifacts when releasing:
   - `npm run rebuild:native:electron`

## Backup

1. Open **Settings > Backup & Restore**.
2. Use the browse button to choose the destination directory, then create the backup.
3. Store the backup database file and manifest file together.
4. Run backup verification and confirm backup freshness alert state is healthy.
5. Optional: run test-restore verification before release cut.

## Recovery Key

1. Export the one-time recovery key after first-run setup.
2. Store recovery key in secured offline location.
3. If machine migration occurs, import recovery key before opening DB.
4. Rotate DB key with rekey workflow after any key-handling incident.

## Restore

1. Open **Settings > Backup & Restore** and use the browse buttons to select the backup file and matching manifest.
2. Run restore and wait for integrity/schema checks.
3. Confirm the post-restore banner:
   - restored timestamp
   - source mutation timestamp ("data current as of")
4. Expect machine-local renderer preferences to reset after restore (this is expected; they remain intentionally machine-local):
   - dashboard layout
   - saved report presets
   - NLQ history
   - quick-start checklist progress
5. Validate key record counts (vendors, services, contracts, expenses).

## Rollback Dry-Run

1. Install latest staging build in a clean environment.
2. Seed sample data, create backup, and export report artifacts.
3. Install previous release build over a clean snapshot.
4. Restore backup and verify:
   - when startup is enabled, sign-in auto-launch starts hidden in tray (Windows)
   - manual app launch opens the main window
   - alerts list available
   - reports and exports still load
5. Record dry-run result before production tag publish.

## Windows ARM64 Release Validation (Manual)

1. Install `BudgetIT-windows-arm64-latest.exe` on Windows ARM64 hardware.
2. Launch BudgetIT and verify DB open/create succeeds.
3. Run core checks:
   - update Settings and restart app
   - load Alerts list
   - create backup and restore it
   - run report/export
4. Confirm there are no native module load errors.
5. Record Windows ARM64 validation sign-off with the release checklist.

## Linux Runtime Validation (Manual)

1. Validate Linux x64 artifacts on Linux x64 hardware:
   - `BudgetIT-linux-x64-latest.AppImage`
   - `BudgetIT-linux-x64-latest.deb`
2. Validate Linux arm64 artifacts on Linux arm64 hardware:
   - `BudgetIT-linux-arm64-latest.AppImage`
   - `BudgetIT-linux-arm64-latest.deb`
3. For both architectures, run core checks:
   - update Settings and restart app
   - load Alerts list
   - create backup and restore it
   - run report/export
4. Confirm there are no native module load errors.
5. Record Linux validation sign-off with the release checklist.
