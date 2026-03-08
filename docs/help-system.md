<!-- AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY. -->
<!-- Edit docs/help/help-topics.json and docs/help/topics/*.md, then run npm run help:generate. -->

# BudgetIT Help System

## Purpose Of BudgetIT
BudgetIT helps IT and operations teams plan, track, and govern technology spend in one place.  
It combines vendor/service/contract tracking, expense planning, scenario comparison, alert triage, data import, and reporting so you can make budget decisions with less manual work.

## Feature Deep-Dives

## Quick Start (First Launch)
### Understand the 2-window workflow
- `App Window`: where you do your work (data entry, review, reporting, and exports).
- `Help Window`: opens from the top-bar **Help** button, desktop **Help** menu entries, or `F1`, then loads a topic-focused section of this guide.

### First 10 minutes
1. Open **Settings** and set core runtime options:
   - Start on system login
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

## 1) App Shell (Global Controls)
### Overview
Use App Shell controls from any page to switch context, jump quickly, and open help without breaking task flow.

### What it includes
- Left navigation sidebar for all workspaces.
- Top bar with:
  - Scenario selector
  - Global Search
  - Help button
- Keyboard command entry points:
  - Command Palette (`Ctrl+K`)
  - Global Search focus (`Ctrl+Shift+F`)
  - Help Center (`F1`)

### Start Here Paths
- New-user path:
  - Confirm the active scenario (usually `Baseline`).
  - Open Help (`F1`) and follow `Quick Start`.
  - Move through setup workspaces in sequence: Vendors -> Services -> Contracts -> Expenses -> Tags.
- Experienced-user path:
  - Open Command Palette (`Ctrl+K`) and jump directly to target route.
  - Use Help search with seeded context from page-level Help buttons.
  - Resolve the immediate task and return to workflow without route hunting.

### Why it matters
- Scenario selector controls data scope used by dashboards, reports, and operational queues.
- Global Search reduces navigation time when reviewing specific entities.
- Command Palette provides deterministic route/action access in keyboard-first workflows.
- Consistent help entry points reduce context switching when triaging issues.

### Common issues and fixes
- Wrong numbers on screen:
  - Re-check active Scenario first.
  - Confirm date/filter context in the current workspace.
- Keyboard command does not open expected UI:
  - Press `Escape` to clear modal focus.
  - Re-run `Ctrl+K` command.
- Help opened but landed on generic content:
  - Use topic dropdown and search index to refine.
  - Validate URL query (`topic`, `anchor`, optional `q`, `context`) if deep-linking.

## 2) Dashboard
Decision summary view for financial and operational signals.

### Main actions
- Change date window: `1m`, `3m`, `12m`, `60m`
- Refresh data
- Export dashboard (`HTML`, `PDF`, `Excel`, `CSV`, `PNG`)
- Edit layout (toggle card visibility, re-order cards, assign sections, add custom sections)
- Reset layout defaults

### KPI Cards

### Forecast KPI
- Definition: sum of forecast spend in the active scenario + selected window.
- Use: baseline expected spend for comparison against actuals.

### Actual KPI
- Definition: sum of observed/actual spend in the active scenario + selected window.
- Use: realized spend used for variance and trend analysis.

### Variance KPI
- Definition: `actual - forecast` for the active window aggregate.
- Positive variance (`> 0`): spend above forecast.
- Negative variance (`< 0`): spend under/within forecast.

### Renewals (Upcoming) KPI
- Definition: count of renewals in the selected window from renewals timeline data.
- Use: near-term operational workload signal.

### Tagging Completeness KPI
- Definition: `(tagged expense lines / total expense lines) * 100`.
- Use: data quality confidence indicator for reporting and allocations.

### Replacement Required KPI
- Definition: number of open replacement-required plans in current scenario.
- Use: highlights technical debt and lifecycle risk backlog.

### Spend Trend Card
- Shows monthly forecast vs actual bars for the selected window.
- Use to detect sustained spend drift, not single-point anomalies only.

### Variance Trend Card
- Shows monthly variance bars (`actual - forecast`) with directionality.
- Pair with Variance KPI for aggregate + monthly diagnostics.

### Renewals Timeline Card
- Shows renewal counts by month.
- Use to schedule owner follow-up and notice-period preparation.

### Growth Trend Card
- Shows month-over-month growth percentages.
- `N/A` means prior month baseline was unavailable/zero for growth calculation.

### Replacement Status Breakdown Card
- Shows count by replacement status category.
- Use to detect blocked/rework-heavy replacement pipelines.

### Narrative Insights
- Shows generated analyst summaries from report narrative blocks.
- Use for executive readouts after KPI/chart review.

### Variance triage workflow
1. Confirm scope: check selected Scenario and date window first.
2. Read aggregate signal: compare Forecast, Actual, and Variance KPIs.
3. Isolate timing: inspect Variance Trend by month to find spike periods.
4. Validate data quality: review Tagging Completeness and required-tag gaps.
5. Check operational drivers: review Renewals and Replacement status signals.
6. Assign next action:
   - Above forecast + valid data -> cost containment or reforecast update.
   - Above forecast + poor tagging -> fix metadata before executive reporting.
   - Under forecast + delayed renewals -> verify execution risk vs savings.

### Forecast freshness warning
- A stale forecast banner indicates data recency risk.
- Use **Open Settings** from the banner to reach maintenance controls.

## 3) Expenses Workspace
### Overview
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
### Overview
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
### Overview
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
### Overview
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
### Overview
Define taxonomy and enforce classification quality across expenses, reports, and allocations.

### Main capabilities
- Create dimensions:
  - Name
  - Mode (`single_select` or `multi_select`)
  - Required (`yes/no`)
- Create tags inside a dimension
- Retire tags
- Merge source tag into target tag
- Fix tagging queue for required dimensions

### Dimension design rules
- Keep dimensions stable and decision-oriented (example: Cost Center, Environment).
- Avoid duplicate semantics across dimensions.
- Mark as `required` only when missing values block downstream reporting decisions.

### Setup sequence for new dimensions
1. Create dimension and choose mode.
2. Add initial tags and publish naming guidance.
3. Mark required only after at least one valid tag exists.
4. Triage missing-tag queue created by requirement enforcement.

### Merge and retire safeguards
- Merge when consolidating synonyms or deprecated values.
- Retire when tag should stop being assigned to new records.
- Validate report/filter behavior after merge to ensure historical continuity.

### Queue triage playbook
1. Filter queue by highest-impact missing dimension first.
2. Assign tags to records with known ownership/context.
3. Route ambiguous rows back to workspace owner for decision.
4. Re-check completeness metrics after batch updates.

### Quality indicators
- Tag completeness percentage
- Queue count for missing required tags
- Suggested thresholds:
  - Green: >= 98% completeness
  - Watch: 95% to 97.9%
  - Action required: < 95%

## 8) Scenarios Workspace
### Overview
Versioned planning controls for simulation, approval, and release readiness.

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

### Scenario lifecycle guidance
- `draft`: active modeling and edits.
- `reviewed`: candidate scenario ready for stakeholder validation.
- `approved`: accepted scenario for operational use/reporting.
- Lock after approval to prevent accidental drift.

### Comparison workflow
1. Select the working scenario.
2. Run compare against baseline.
3. Review local change summaries (workspace-level deltas).
4. Review database summaries (persisted data differences).
5. Validate that major KPI shifts are explained and traceable.

### Promotion gate checklist
- Material deltas are documented.
- Required tags/metadata are complete for changed records.
- Reconciliation queue risk is reviewed when actuals are involved.
- Stakeholder sign-off is recorded before promote.

### Governance notes
- Clone baseline for major planning cycles instead of editing baseline directly.
- Use lock/unlock intentionally; log owner and reason for unlock events.
- Treat scenario status as process truth for downstream reporting cadence.

## 9) Alerts Inbox
### Overview
Central triage queue for reminders, renewal deadlines, and operational follow-ups.

### Queue views
- Due soon: active, time-sensitive items requiring near-term action.
- Snoozed: temporarily deferred alerts with a resume date.
- Acked: acknowledged items retained for audit trace.
- All: combined view for broad review and handoffs.

### Triage playbook
1. Start with `Due soon` and sort by nearest due date.
2. Open each row and confirm owner + linked entity.
3. Take one disposition per alert:
   - `Review` when additional context is needed.
   - `Ack` when action is complete and trace should remain.
   - `Snooze +7d` when deferring with an explicit revisit date.
   - `Open entity` for direct correction in source workspace.
4. Re-check queue counts after action batch.

### Row actions
- Review
- Ack
- Snooze until +7d
- Open entity

### Detail panel fields
- Message
- Due date
- Related entity
- Trigger reason
- Recommended next actions

### Alert lifecycle guidance
- Prefer `Ack` only after a concrete action is performed.
- Use snooze sparingly and with owner accountability.
- If alert repeats across cycles, treat as process-quality signal and escalate.

### Weekly operations checkpoint
- Clear overdue and due-soon items.
- Confirm high-risk alerts are owned.
- Track repeated trigger patterns and open remediation tasks.

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

### Glossary: import statuses and match outcomes
- `accepted`: row passed validation and is eligible for insert/match processing.
- `rejected`: row failed validation and is excluded from commit.
- `duplicate`: row fingerprint matched an earlier row in the same run and is skipped.
- `matched`: actuals transaction linked to an existing expense occurrence.
- `unmatched`: transaction has no selected/valid occurrence match and requires queue review.
- `ignored`: unmatched transaction intentionally left unresolved for current cycle.

### Reconciliation playbook
1. Run preview and resolve validation/duplicate errors first.
2. Commit in `actuals` mode and review matched/unmatched counts.
3. Open unmatched queue follow-up items and decide one action per row:
   - Match to an existing occurrence.
   - Reject when source data is invalid.
   - Ignore when deferring to a later cycle.
   - Create expense when a new recurring/planned line is required.

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

### Executive export playbook
1. Select a report preset aligned to the audience (`Dashboard Overview` for exec cadence).
2. Set reporting period filters and confirm Scenario context.
3. Keep required visualizations enabled (`Table`, `Chart`, `Gauge`, `Narrative`) for complete briefing.
4. Confirm destination and run preview before queueing.
5. Queue export in required format(s) and verify output path in export metadata.
6. Review Data Quality Guardrails and unresolved unmatched actuals before distribution.

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

### Unmatched actuals review
1. Confirm the queue summary (`unmatched count`, `unmatched amount`, `driver mix`).
2. Pick a suggested match when a valid occurrence exists.
3. Choose a driver (`timing`, `price`, `scope`) and add analyst comment when needed.
4. Apply one disposition per row:
   - `Match`: link to occurrence.
   - `Reject`: mark invalid source record.
   - `Ignore`: defer resolution for this cycle.
   - `Create expense`: open planned-line workflow from actuals evidence.

### Glossary: reconciliation statuses
- `No match selected`: queue item has not been routed to an occurrence yet.
- `Match`: transaction is reconciled against an existing planned line.
- `Reject`: transaction is excluded due to invalid source or business exclusion.
- `Ignore`: transaction remains unresolved intentionally for follow-up.
- `Create expense`: promotes unmatched signal into a new expense record candidate.

### Weekly operating checklist
- Refresh primary report preset(s) with current week filters.
- Review unmatched actuals queue and clear high-priority rows.
- Check data quality guardrails and assign fixes for missing metadata.
- Queue weekly export package and confirm artifact paths.

### Monthly operating checklist
- Run executive export playbook using month-end filters.
- Validate narrative block accuracy against KPI/trend signals.
- Generate showback statements for finance review.
- Archive/export run outputs and note unresolved reconciliation exceptions.

## 12) NLQ Workspace
### Overview
Natural-language query interface for report-ready data retrieval with filter explainability.

### Main flow
- Enter prompt and run query
- Use example prompts
- Re-run from query history
- Review parsed filter spec explanation
- Review matched rows (sortable)
- Export results (`CSV` or `Excel`)
- Save as report preset

### Prompt construction pattern
- Preferred template:
  - Metric or question
  - Time window
  - Scope filters (scenario, vendor, tag, owner)
- Example:
  - "Show monthly variance for baseline in Q1 for cost center Security."

### Parsed filter review checklist
- Confirm date range interpretation.
- Confirm tag/vendor filters match intent.
- Confirm scenario context is correct before exporting.
- If parse is off, rewrite prompt with explicit constraints.

### Result validation checklist
- Spot-check top rows against known source records.
- Compare aggregates against Dashboard/Reports metrics.
- Flag major mismatches before sharing exported outputs.

### Inputs and actions
- Prompt input
- Export format + output directory
- Save report name

### Failure handling
- No results:
  - Loosen overly specific filters.
  - Verify selected scenario contains expected records.
- Unexpected parse:
  - Use shorter, explicit prompt terms.
  - Re-run and inspect parsed filter explanation before export.

## 13) Settings Center
Runtime, security, backup, maintenance, and governance configuration.

### Runtime
- Start on system login
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

## 14) Developer Tools
### Overview
Developer Tools is no longer a full product workspace. It exists as a narrow diagnostic landing page for local development and verification.

### What remains
- Confirmation that the legacy monolithic workspace is retired.
- Guidance to use the routed workspaces for shipped BudgetIT functionality.
- Guidance to use package scripts and test commands for diagnostics.

### Recommended actions
- Use routed workspaces (`Dashboard`, `Expenses`, `Services`, `Contracts`, `Vendors`, `Tags`, `Scenarios`, `Alerts`, `Import`, `Reports`, `NLQ`, `Settings`) for app behavior checks.
- Use repo commands for diagnostics:
  - `npm run test`
  - `npm run help:check`
  - package-scoped test/build commands as needed

### Common confusion
- Looking for the old all-in-one workspace:
  - It has been retired from the shipped shell.
  - Use the routed workspaces instead.
- Looking for product help from this page:
  - Open Help and jump directly to the routed workspace you are validating.

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
- `q` query parameter seeds the Help search index input.
- `context` query parameter carries source-page context text for operator orientation.
- If `topic` is missing/invalid, Help defaults to `quick-start`.
- Topic dropdown options are grouped by journey step (Orientation, Setup, Import, Analysis, Reporting, Operations).
- Changing the Help topic dropdown updates `topic`, clears `anchor`, and re-renders content.
- When search input changes, Help updates `q` in the URL for reproducible deep links.

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

## Reporting Cadence Checklist

### Weekly
1. Refresh key report preset(s) with current date/tag filters.
2. Review unmatched actuals queue and resolve priority transactions.
3. Validate Data Quality Guardrails and assign metadata remediation.
4. Queue weekly exports and verify output paths in export metadata.

### Monthly
1. Run monthly executive export workflow end-to-end.
2. Validate narrative insights against KPI + chart outputs.
3. Generate and export showback statements.
4. Record unresolved exceptions and owners for next cycle.

## Help Document Maintenance Notes
- Do not edit generated files directly:
  - `docs/help-system.md`
  - `apps/renderer/src/features/help/help-topics.ts`
- Update help source files instead:
  - `docs/help/help-topics.json`
  - `docs/help/topics/*.md`
  - `docs/help/intro.md`
  - `docs/help/appendices/*.md`
- After edits, regenerate and validate:
  - `npm run help:generate`
  - `npm run help:check`
- Keep shortcut and menu wording aligned with implemented behavior in:
  - `apps/renderer/src/app/AppShell.tsx`
  - `apps/desktop/src/main.ts`

## PR Maintenance Checklist
1. Update source help files only (`docs/help/**` source-of-truth files).
2. Run `npm run help:generate`.
3. Run `npm run help:check`.
4. Commit source + generated outputs together.
5. Ensure CI status checks are green before merge.

## Required Status Check Enforcement
For `main` branch protection, require at minimum:
- `Help Integrity`
- `Lint, Typecheck, Test, Build`

If repository rules are managed via GitHub UI:
1. Open **Settings > Branches > Branch protection rules**.
2. Edit rule for `main`.
3. Enable **Require status checks to pass before merging**.
4. Select both checks above and save.
