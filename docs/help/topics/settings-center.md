Runtime, security, backup, maintenance, and governance configuration.

### Runtime
- Start on system login
- Minimize to tray on close
- On Windows, auto-start launches from sign-in open hidden in the tray (manual launches still open the main window)
- Save runtime settings
- Use `Start on system login` when BudgetIT should behave like an always-available desktop utility.
- Use `Minimize to tray on close` when you want the app to keep running without taking taskbar space.
- New-user default:
  - Enable auto-start only if BudgetIT is part of your daily workflow.
  - Enable tray minimize if you want background reminders and quick reopen behavior.

### Notifications
- Enable Teams webhook channel
- Teams webhook URL
- Save notifications
- Send Teams test
- Enable the Teams channel only after you have a valid inbound webhook for the team that should receive alerts.
- Use `Send Teams test` before relying on production alert delivery.
- If your organization does not use Teams for ops notifications yet, leave this disabled until the endpoint is ready.

### Backup & Restore
- Create backup (destination directory)
- Restore backup (backup path + manifest path)
- Verify backup integrity (optional backup/manifest paths)
- Create a backup immediately after initial setup and again before risky changes or restore exercises.
- Restore should be treated as an intentional recovery operation, not a routine workflow.
- Run verification after backup creation and before restore drills to confirm the archive and manifest are readable together.
- Keep backup files somewhere recoverable outside the primary machine whenever possible.

### Security
- Safe storage status
- Database key status
- Re-key database
- Re-key only when you have a concrete security reason, such as key rotation policy or suspected exposure.
- Treat re-keying like a maintenance event: ensure a recent verified backup exists first.

### Maintenance
- Re-materialize forecast
- Run diagnostics
- Re-materialize forecast when scenario or recurrence data has changed and downstream totals need to be refreshed.
- Run diagnostics when numbers, joins, or workflow state appear inconsistent and you need evidence before changing records.

### Scenario Planning
- Fiscal year start month
- Horizon months
- Default currency
- Fiscal year start month:
  - Use the month your organization treats as month 1 of the planning year.
  - Example: `1` for January, `7` for July.
- Horizon months:
  - Controls how far forward planning and forecast generation should extend.
  - Common starting point: `12` for annual planning, `24` or more for longer replacement planning.
- Default currency:
  - Use the reporting currency your team expects in standard views and exports.
  - Choose the currency you want new users to interpret totals in by default.

Example setup:
- Fiscal year start month = `1` for calendar-year planning
- Horizon months = `12` for one-year outlook
- Default currency = `USD` when most operators and exports are US-dollar based

### New-user recommended starting profile
- Runtime:
  - Start on system login = only if BudgetIT is part of daily operations
  - Minimize to tray = yes if you want background access
- Notifications:
  - Teams disabled until webhook is tested
- Backup:
  - create and verify one backup immediately
- Scenario planning:
  - start month = your real planning calendar
  - horizon = `12` unless your replacement planning requires a longer window

### Finance Reference Data
- Add/toggle Cost Centers
- Add/toggle GL Accounts
- Use these lists to standardize values that appear in imports, tagging, and reporting.
- Add only values your team actually uses in operational reporting to avoid noisy pick lists.

### Operational Evidence
- Teams endpoint health
- Recent approvals
- Recent audit records
- Use this section when you need traceability that a setting, approval, or notification path is functioning as expected.
