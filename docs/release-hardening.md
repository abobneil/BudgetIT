# Release Hardening Checklist

This checklist is run before any production `v*` tag is published.

## Packaging QA

1. Confirm CI quality job passed (`lint`, `typecheck`, `test`, `build`).
2. Confirm Windows NSIS artifact exists in `dist/release/*.exe`.
3. Confirm installer smoke checks passed (`npm run smoke:packaged`).
4. Confirm SHA256 checksum file was generated (`dist/release/SHA256SUMS.txt`).
5. Confirm release notes include upgrade and rollback guidance.

## Startup Defaults and Overrides

1. Verify packaged defaults:
   - `startWithWindows = true`
   - `minimizeToTray = true`
2. Verify user overrides persist after restart:
   - toggle startup/tray options
   - restart app
   - confirm persisted values in Settings UI
3. Verify explicit tray `Exit` ends process and scheduler.

## Rollback Notes

1. Keep previous installer artifact and its checksum.
2. If release fails in production:
   - install previous known-good version
   - restore latest valid backup
   - verify “data current as of” banner
3. Record rollback event in release notes and incident log.
