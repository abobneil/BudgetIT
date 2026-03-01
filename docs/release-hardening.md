# Release Hardening Checklist

This checklist is run before any production `v*` tag is published.

## Packaging QA

1. Confirm CI quality job passed (`lint`, `typecheck`, `test`, `build`).
2. Confirm Windows artifacts exist:
   - `dist/release/BudgetIT-Setup-<version>-x64.exe`
   - `dist/release/BudgetIT-Setup-<version>-arm64.exe`
3. Confirm Linux artifacts exist:
   - `dist/release/BudgetIT-<version>-linux-x64.AppImage`
   - `dist/release/BudgetIT-<version>-linux-x64.deb`
   - `dist/release/BudgetIT-<version>-linux-arm64.AppImage`
   - `dist/release/BudgetIT-<version>-linux-arm64.deb`
4. Confirm packaged smoke checks passed:
   - `npm run smoke:packaged:win`
   - `npm run smoke:packaged:linux`
5. Confirm SHA256 checksum file was generated (`dist/release/SHA256SUMS.txt`).
6. Confirm release notes include upgrade and rollback guidance.

## Windows ARM64 Runtime QA (Manual)

1. Install `BudgetIT-Setup-<version>-arm64.exe` on a Windows ARM64 device.
2. Launch the app and open or create the encrypted database.
3. Validate core runtime flows:
   - settings save/app restart
   - alerts list load
   - backup create + restore
   - report/export action
4. Confirm there are no native module load failures in logs/runtime UI.
5. Record Windows ARM64 QA sign-off before publishing production release.

## Linux Runtime QA (Manual)

1. Install/run Linux x64 artifacts (`.AppImage` and `.deb`) on a Linux x64 test host.
2. Install/run Linux arm64 artifacts (`.AppImage` and `.deb`) on a Linux arm64 test host.
3. For both architectures, validate core runtime flows:
   - settings save/app restart
   - alerts list load
   - backup create + restore
   - report/export action
4. Confirm there are no native module load failures in logs/runtime UI.
5. Record Linux QA sign-off before publishing production release.

## Startup Defaults and Overrides

1. Verify packaged defaults:
   - startup enabled (`startWithWindows = true` persisted key)
   - `minimizeToTray = true`
2. Verify user overrides persist after restart:
   - toggle startup/tray options
   - restart app
   - confirm persisted values in Settings UI
3. Verify explicit tray `Exit` ends process and scheduler.

## Rollback Notes

1. Keep previous release artifacts and their checksums.
2. If release fails in production:
   - install previous known-good version
   - restore latest valid backup
   - verify "data current as of" banner
3. Record rollback event in release notes and incident log.
