# BudgetIT Operator Runbook

This runbook is for single-device Windows operation of BudgetIT.

## Backup

1. Open BudgetIT and run backup from the runtime panel.
2. Store backup and manifest files together.
3. Verify backup freshness alert state is healthy.
4. Optional: run test-restore verification before release cut.

## Recovery Key

1. Export the one-time recovery key after first-run setup.
2. Store recovery key in secured offline location.
3. If machine migration occurs, import recovery key before opening DB.
4. Rotate DB key with rekey workflow after any key-handling incident.

## Restore

1. Select backup file and matching manifest.
2. Run restore and wait for integrity/schema checks.
3. Confirm the post-restore banner:
   - restored timestamp
   - source mutation timestamp (“data current as of”)
4. Validate key record counts (vendors, services, contracts, expenses).

## Rollback Dry-Run

1. Install latest staging build in clean Windows VM.
2. Seed sample data, create backup, and export report artifacts.
3. Install previous release build over VM image snapshot.
4. Restore backup and verify:
   - app launches to tray
   - alerts list available
   - reports and exports still load
5. Record dry-run result before production tag publish.
