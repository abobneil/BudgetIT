# BudgetIT Help System

## Purpose Of BudgetIT
BudgetIT helps IT and operations teams plan, track, and govern technology spend in one place.  
It combines vendor/service/contract tracking, expense planning, scenario comparison, alert triage, data import, and reporting so you can make budget decisions with less manual work.

## Quick Start (First Launch)

### Understand the 2-window workflow
- `App Window`: where you do your work (data entry, review, reporting, and exports).
- `Help Window`: opens from the top-bar **Help** button, desktop **Help** menu entries, or `F1`, then loads a topic-focused section of this guide.

### First 10 minutes
1. Open **Settings** and set core runtime options:
   - Start with Windows
   - Minimize to tray
   - Teams webhook (optional)
2. In **Settings > Backup & Restore**, create your first backup and run verification.
3. Use the top **Scenario selector** to confirm you are working in the correct scenario (usually `Baseline` first).
4. Add core records in this order:
   - Vendors
   - Services
   - Contracts
   - Expenses
5. Open **Tags & Dimensions** and set required dimensions (for example, Cost Center).
6. Open **Dashboard** to confirm data appears in KPIs and trend cards.
7. Optional speed tools:
   - `Ctrl+K` opens Command Palette.
   - `Ctrl+Shift+F` focuses Global Search.
   - `Escape` closes the active dialog.
   - `F1` opens Help Center.

### Navigation at a glance
- Dashboard
- Expenses
- Services
- Contracts
- Vendors
- Tags & Dimensions
- Scenarios
- Alerts
- Import
- Reports
- NLQ
- Settings

## Feature Deep-Dives

## 1) App Shell (Global Controls)
Use this area from any page.

### What it includes
- Left navigation sidebar for all modules.
- Top bar with:
  - Scenario selector
  - Global Search
  - Help button

### Why it matters
- Scenario selector controls which data context many pages use.
- Global Search helps jump directly to records from anywhere in the app.
- Command Palette is keyboard-driven (`Ctrl+K`) for quick route/actions.
- Keyboard shortcuts can be viewed from Command Palette (`Show Keyboard Shortcuts`).

## 2) Dashboard
Decision summary view for financial and operational signals.

### Main actions
- Change date window: `1m`, `3m`, `12m`, `60m`
- Refresh data
- Export dashboard (`HTML`, `PDF`, `Excel`, `CSV`, `PNG`)
- Edit layout (toggle card visibility, re-order cards, assign sections, add custom sections)
- Reset layout defaults

### Major content
- KPI cards: Forecast, Actual, Variance, Renewals, Tagging Completeness, Replacement Required
- Chart cards: Spend Trend, Variance, Renewals Timeline, Growth, Replacement Status Breakdown
- Narrative insights
- Forecast freshness warning banner (links to Settings)

## 3) Expenses Workspace
Manage expense lines, status, tags, and recurrence.

### Toolbar
- Search by name/vendor/service/contract/tag
- Vendor filter
- Status quick filters (`all`, `planned`, `approved`, `committed`, `actual`, `cancelled`)
- Bulk tools:
  - Bulk set Approved
  - Bulk tag entry (dimension + tag selection)

### Table and detail
- Row selection checkboxes (supports bulk updates)
- Sortable columns (fallback table) and CSV export (grid mode)
- Detail panel shows:
  - Core fields
  - Tag assignments by dimension
  - Tag assign/remove controls
  - Next 12 recurrence occurrences

### Create/Edit Expense form
- Core details:
  - Expense name
  - Amount (minor units)
  - Status
  - Vendor
- Links and tags:
  - Linked service
  - Linked contract
  - Tags (comma-separated)
- Recurrence:
  - Frequency
  - Interval
  - Day of month
  - Anchor date

### Safety action
- Delete confirmation dialog

## 4) Services Workspace
Track service lifecycle, risk, renewals, and replacement posture.

### Toolbar
- Search by service/vendor/owner
- Vendor filter
- Risk filter

### Table actions
- Review
- Edit
- Open contract
- Open alert
- Open replacement
- Delete

### Detail tabs
- Overview
- Expenses
- Contracts
- Renewals
- Replacement Plan

### Create/Edit Service form
- Service name
- Vendor
- Owner
- Annual spend (minor units)
- Status (`active`, `trial`, `deprecated`, `retiring`, `retired`)
- Risk (`low`, `medium`, `high`)
- Replacement status (`not-started`, `candidate-review`, `approved`)

### Safety action
- Delete confirmation dialog

## 5) Contracts Workspace
Manage contract terms, renewal windows, and linked services.

### Toolbar
- Search by contract/provider/owner
- Status filter (`active`, `renewal-window`, `notice-window`, `expired`)

### Table actions
- Review
- Edit
- Open service
- Open alert
- Open replacement
- Delete

### Detail panel
- Provider, owner, term dates
- Renewal action and linked services
- Quick actions:
  - Open related alert
  - Open replacement workspace
  - Start renewal review

### Create/Edit Contract form
- Linked service
- Contract number
- Owner
- Start date
- End date
- Renewal type (`auto`, `manual`, `none`)
- Renewal date
- Notice period days
- Lifecycle status
- Renewal action (`auto-renew`, `manual-review`, `cancel-window`)

### Safety action
- Delete confirmation dialog

## 6) Vendors Workspace
Manage vendor lifecycle with archive/delete guards.

### Toolbar
- Search by name, owner, or status

### Table actions
- Review
- Edit
- Open services
- Open expenses
- Archive
- Delete

### Detail panel
- Owner, annual spend, status, risk
- Linked services with quick open
- Linked contracts with quick open

### Create/Edit Vendor form
- Core details:
  - Vendor name
  - Owner
  - Annual spend (minor units)
  - Status (`active`, `watch`, `archived`)
  - Risk (`low`, `medium`, `high`)
- Linked records (optional):
  - Linked service IDs (CSV)
  - Linked contract IDs (CSV)

### Guardrails
- Archive can be blocked if already archived.
- Delete is blocked when linked services/contracts exist.

### Safety actions
- Archive confirmation dialog
- Delete confirmation dialog

## 7) Tags & Dimensions
Define taxonomy and improve classification quality.

### Main capabilities
- Create dimensions:
  - Name
  - Mode (`single_select` or `multi_select`)
  - Required (`yes/no`)
- Create tags inside a dimension
- Retire tags
- Merge source tag into target tag
- Fix tagging queue for required dimensions

### Quality indicators
- Tag completeness percentage
- Queue count for missing required tags

## 8) Scenarios Workspace
Versioned planning controls for simulation and approval flow.

### Main actions per scenario
- Select
- Clone
- Promote (`draft -> reviewed -> approved`)
- Lock
- Compare to baseline

### Data shown
- Scenario name
- Status
- Lock state
- Parent scenario
- Created date
- Comparison summaries (local and database-based)

## 9) Alerts Inbox
Central triage for reminders and deadlines.

### Tabs
- Due soon
- Snoozed
- Acked
- All

### Row actions
- Review
- Ack
- Snooze until +7d
- Open entity

### Detail panel
- Message
- Due date
- Related entity
- Trigger reason
- Recommended next actions

## 10) Import Wizard
Guided import for expenses and actuals.

### 5 steps
1. Mode (`expenses` or `actuals`)
2. File (source path)
3. Mapping template
4. Preview
5. Commit

### Mapping step controls
- Template name
- Cloud template pack (`AWS CUR`, `Azure cost export`, `GCP billing export`)
- Use saved template
- Save template
- Enforce finance metadata
- Template library (refresh, use template, delete template)

### Preview step
- Accepted / Rejected / Duplicate counts
- Dedupe policy summary
- Row preview table
- Error review filter (`all`, `validation`, `duplicate`)
- Optional tagging suggestions

### Commit step
- Commit import
- Summary counts
- Actuals mode extras:
  - matched/unmatched counts
  - match rate
  - unmatched queue follow-up list

## 11) Reports Workspace
Flexible reporting, export orchestration, and operational finance tools.

### Report gallery
- Open preset reports (Dashboard Overview, Renewals Pipeline, Spend by Tag/Vendor, Replacement Pipeline, Tagging Completeness)

### Workspace filters
- Start date
- End date
- Tag filter
- Visualization toggles:
  - Table
  - Chart
  - Gauge
  - Narrative

### Export orchestration
1. Choose format
2. Confirm destination path
3. Preview report and queue export

### Additional reporting operations
- Save current view as report preset
- Export job history table
- Data Quality Guardrails summary
- Unmatched Actuals Review:
  - Suggested match
  - Driver + comment
  - Match / Reject / Ignore / Create expense
- Showback Statements:
  - Period filters
  - Group by (`cost_center`, `team`)
  - Generate statement
  - Export CSV/XLSX

## 12) NLQ Workspace
Natural-language query interface for report-ready data retrieval.

### Main flow
- Enter prompt and run query
- Use example prompts
- Re-run from query history
- Review parsed filter spec explanation
- Review matched rows (sortable)
- Export results (`CSV` or `Excel`)
- Save as report preset

### Inputs and actions
- Prompt input
- Export format + output directory
- Save report name

## 13) Settings Center
Runtime, security, backup, maintenance, and governance configuration.

### Runtime
- Start with Windows
- Minimize to tray on close
- On Windows, auto-start launches from sign-in open hidden in the tray (manual launches still open the main window)
- Save runtime settings

### Notifications
- Enable Teams webhook channel
- Teams webhook URL
- Save notifications
- Send Teams test

### Backup & Restore
- Create backup (destination directory)
- Restore backup (backup path + manifest path)
- Verify backup integrity (optional backup/manifest paths)

### Security
- Safe storage status
- Database key status
- Re-key database

### Maintenance
- Re-materialize forecast
- Run diagnostics

### Scenario Planning
- Fiscal year start month
- Horizon months
- Default currency

### Finance Reference Data
- Add/toggle Cost Centers
- Add/toggle GL Accounts

### Operational Evidence
- Teams endpoint health
- Recent approvals
- Recent audit records

## Help Center Behavior (Current Implementation)
BudgetIT Help is route-driven and topic-based. The Help window/page renders content from this document based on topic mapping.

### Launch points
- Top-bar **Help** button opens Help Center.
- Desktop menu **Help > Help Center** opens `quick-start`.
- Desktop menu **Help > Keyboard Shortcuts** opens `global-keyboard-shortcuts`.
- `F1` opens Help Center.

### Topic selector and query parameters
- Base route: `/help`
- `topic` query parameter selects a help topic ID (example: `dashboard-overview`).
- `anchor` query parameter scrolls to a heading within the rendered topic section.
- If `topic` is missing/invalid, Help defaults to `quick-start`.
- Changing the Help topic dropdown updates `topic` and re-renders content.

### Section extraction and fallback behavior
- Each Help topic maps to a `docSection` heading in this file.
- Help renders from matching `## <docSection>` until the next `##` heading.
- If a mapped heading is missing, Help shows the full document and a fallback note.

### Anchor behavior
- `anchor` supports direct scroll to matching heading IDs in rendered markdown.
- Anchor matching uses normalized heading IDs (lowercase, punctuation removed, spaces converted to `-`).

### Current scope note
- Inline contextual `(?)` popups are not currently shipped in the renderer.
- In-product help is delivered through the dedicated Help route/window and topic selection.

## Example Workflows (Step-by-Step)

## Workflow 1: Add a New Vendor-To-Expense Chain
Goal: Add a new vendor, service, contract, and recurring expense.

1. Go to **Vendors** and select **Create Vendor**.
2. Enter vendor name, owner, spend, status, and risk, then save.
3. Go to **Services** and select **Create Service**.
4. Link it to the vendor, set owner, spend, risk, and replacement status.
5. Go to **Contracts** and select **Create Contract**.
6. Link the service, add contract number, dates, renewal settings, and save.
7. Go to **Expenses** and select **Create Expense**.
8. Enter core details, link service/contract, set recurrence, and save.
9. In expense detail, assign required tags.
10. Confirm the record appears in **Dashboard** and **Reports**.

## Workflow 2: Import Actuals and Resolve Unmatched Transactions
Goal: Bring in actuals, then clear unresolved items.

1. Open **Import**.
2. Step 1: set mode to `Actuals`.
3. Step 2: enter source file path.
4. Step 3: choose template settings (saved template or cloud pack).
5. Step 4: run preview and review validation/duplicate errors.
6. Step 5: commit import.
7. Open **Reports > Unmatched Actuals Review**.
8. For each unmatched row, choose suggested match and optional driver/comment.
9. Click **Match**, **Reject**, **Ignore**, or **Create expense**.
10. Re-check unmatched count and driver mix summary.

## Workflow 3: Prepare a Monthly Executive Export
Goal: Produce and queue report exports with quality checks.

1. Go to **Reports**.
2. In **Report Gallery**, open a preset (for example, Dashboard Overview).
3. Set date range and tag filter in **Workspace Filters**.
4. Toggle visualization blocks you want included.
5. In **Export Orchestration**, choose format.
6. Enter and confirm destination path.
7. (Recommended) Click **Preview report** and review output.
8. Click **Queue export**.
9. Check **Export metadata** table for status/output path.
10. Review **Data Quality Guardrails** and fix warnings before final sharing.

## Workflow 4: Scenario Comparison for Planning Review
Goal: Compare a draft scenario with baseline and promote if ready.

1. Open **Scenarios**.
2. Clone baseline to create a working scenario.
3. Use top **Scenario selector** to switch to the new scenario.
4. Update records in Expenses/Services/Contracts as needed.
5. Return to **Scenarios** and click **Compare** on the working scenario.
6. Review local and database comparison deltas.
7. If approved by your process, click **Promote**.
8. Lock scenario when changes should stop.

## Help Document Maintenance Notes
- Keep the mapped section headers unchanged:
  - `## Quick Start (First Launch)`
  - `## 1) App Shell (Global Controls)` through `## 13) Settings Center`
- If mapped headings are renamed, update `apps/renderer/src/features/help/help-topics.ts` in the same change.
- Keep shortcut and menu wording aligned with implemented behavior in:
  - `apps/renderer/src/app/AppShell.tsx`
  - `apps/desktop/src/main.ts`
