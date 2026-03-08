<!-- AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY. -->
<!-- Edit docs/help/help-topics.json and docs/help/topics/*.md, then run npm run help:generate. -->

# BudgetIT Help System

## Purpose Of BudgetIT
BudgetIT helps IT and operations teams plan, track, and govern technology spend in one place.  
It combines vendor/service/contract tracking, expense planning, scenario comparison, alert triage, data import, and reporting so you can make budget decisions with less manual work.

## BudgetIT Method
BudgetIT works best when you treat technology spend as a connected operating model instead of a loose collection of spreadsheets.

- Vendors tell you who you buy from.
- Services tell you what capability the business depends on.
- Contracts tell you the commercial terms and renewal obligations.
- Expenses tell you what you expect to spend or what you already spent.
- Tags tell you how to classify that spend for reporting and accountability.
- Scenarios tell you which version of the plan you are currently evaluating.
- Alerts, Imports, Reports, and NLQ help you operate the plan after setup.

The standard working rhythm is:
1. Build or confirm the planning baseline.
2. Classify records so reporting is trustworthy.
3. Compare forecast and actuals.
4. Resolve operational exceptions such as renewals, unmatched transactions, and stale assumptions.
5. Export or share decision-ready outputs.

## Core Planning Model
- A `vendor` is the supplier relationship.
- A `service` is the product or capability being delivered.
- A `contract` is the governing agreement.
- An `expense` is the planned or realized money movement tied to that stack.

In many cases the chain looks like this:
- Vendor -> Service -> Contract -> Expense

Example:
- Vendor: `Microsoft`
- Service: `Endpoint Security`
- Contract: `CTR-M365-E5-2026`
- Expense: `Endpoint Security Annual Renewal`

Not every record requires the full chain on day one, but the more complete the links are, the better your downstream reporting, reconciliation, and renewal guidance will be.

## Recommended New-User Order
If you are setting up BudgetIT for the first time, use this order:
1. Confirm the active scenario is `Baseline`.
2. Add vendors.
3. Add services and connect them to vendors.
4. Add contracts and connect them to services.
5. Add expenses and connect them to the right service/contract where possible.
6. Create required tags such as Cost Center or Environment.
7. Validate the Dashboard.
8. Start imports and reporting only after the baseline is understandable.

## How To Use This Help Center
Use the Help Center in three passes when you are learning the system:

1. Read the topic for the screen you are on so you understand the controls in front of you.
2. Use `Concepts, Terms, And Decision Rules` when a field or status is unfamiliar.
3. Use `End-To-End Example` and `Common Mistakes And Good Practices` when you want to see how the method works in practice.

If you only remember one rule, remember this:
- Do not model technology spend as isolated rows.
- Link records wherever you can so BudgetIT can explain renewals, variance, ownership, and replacement decisions later.

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

Why this order:
- Vendors, Services, Contracts, and Expenses build the planning backbone.
- Tags make the data usable in reporting.
- Dashboard is the first place to confirm that setup decisions are producing understandable outputs.

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

### First-week goals
- By the end of week 1, a new user should be able to:
  - explain the vendor -> service -> contract -> expense chain,
  - identify which scenario is active,
  - classify records with at least one required dimension,
  - read forecast vs actual variance without guessing what the terms mean,
  - produce at least one review-ready report export.

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

### Control guidance
- Scenario selector:
  - Changes the active planning context used by dashboards, reports, and many workspace views.
  - If totals look wrong, check this first.
- Global Search:
  - Best for jumping to a known entity when you already know the name.
- Help button:
  - Opens contextual help for the current route.
- Command Palette:
  - Best for keyboard-first users who know the action or workspace they want.

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
- Example:
  - Forecast = `$120,000`
  - Meaning: BudgetIT expects that amount for the current scenario and time window.

### Actual KPI
- Definition: sum of observed/actual spend in the active scenario + selected window.
- Use: realized spend used for variance and trend analysis.
- Example:
  - Actual = `$127,500`
  - Meaning: real spend is higher than planned and should be compared to Forecast immediately.

### Variance KPI
- Definition: `actual - forecast` for the active window aggregate.
- Positive variance (`> 0`): spend above forecast.
- Negative variance (`< 0`): spend under/within forecast.
- Example:
  - Forecast = `$120,000`
  - Actual = `$127,500`
  - Variance = `$7,500`
  - Interpretation: spend is over plan for the selected scope.

### Renewals (Upcoming) KPI
- Definition: count of renewals in the selected window from renewals timeline data.
- Use: near-term operational workload signal.

### Tagging Completeness KPI
- Definition: `(tagged expense lines / total expense lines) * 100`.
- Use: data quality confidence indicator for reporting and allocations.
- Decision rule:
  - If completeness is weak, treat filtered reports cautiously because the data may not be fully classified yet.

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
- Treat narrative as a summary aid, not a substitute for checking the underlying signals.

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

Example:
1. Variance is high.
2. Tagging Completeness is low.
3. Action: fix missing tags before telling leadership the overspend belongs to a specific area.

### Dashboard reading pattern
1. Confirm scenario and time window.
2. Read Forecast, Actual, and Variance together.
3. Use trend cards to determine whether the issue is one-time or persistent.
4. Check data quality and renewal pressure before deciding the story behind the numbers.

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
- Bulk actions are most useful after search/filter narrows the table to a coherent batch.

### Table and detail
- Row selection checkboxes (supports bulk updates)
- Sortable columns (fallback table) and CSV export (grid mode)
- Detail panel shows:
  - Core fields
  - Tag assignments by dimension
  - Tag assign/remove controls
  - Next 12 recurrence occurrences
- Use the recurrence preview to validate cadence assumptions before trusting forecast totals.

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

### Expense field guidance
- Expense name:
  - Use a label the finance or operations team would recognize in reports.
  - Example: `Endpoint Security` or `Cloud Compute`.
- Amount (minor units):
  - BudgetIT stores currency in minor units.
  - Example: `5000` means `$50.00`.
- Status:
  - `planned`: expected spend not yet approved.
  - `approved`: decision made; spend is expected to happen.
  - `committed`: contractual or operational commitment exists.
  - `actual`: observed spend has occurred.
  - `cancelled`: line should no longer be expected or recognized going forward.
  - New-user default: use `approved` for normal forward-looking budget lines and `actual` only for realized activity.
- Vendor:
  - Use the supplier responsible for the spend.
  - If the expense belongs to an existing service, make sure vendor choice aligns with that service's vendor when possible.
- Linked service:
  - Use when the spend clearly supports a service record and should roll up with that context.
- Linked contract:
  - Use when the spend is governed by a known contract and you want renewal/commitment context preserved.
- Tags:
  - Use tags for reporting dimensions such as Cost Center, Environment, Department, or Risk grouping.
  - Use consistent spelling and naming so filters stay clean.
- Recurrence frequency:
  - `monthly`, `quarterly`, or `yearly` depending on how often the charge repeats.
- Interval:
  - Use `1` for every cycle, `2` for every other cycle, and so on.
  - Example: quarterly + interval `1` means every quarter; monthly + interval `3` means every three months.
- Day of month:
  - Use the expected posting or billing day when monthly timing matters.
  - If exact timing is not important, use a consistent estimate.
- Anchor date:
  - Use the date the recurrence pattern begins.
  - This is the base date BudgetIT uses to generate future occurrences.

### Worked example
- Situation:
  - Endpoint security renews every year in March.
- Reasonable first record:
  - Expense name = `Endpoint Security Annual Renewal`
  - Status = `approved`
  - Vendor = security vendor
  - Linked service = `Endpoint Security`
  - Linked contract = renewal contract
  - Frequency = `yearly`
  - Interval = `1`
  - Anchor date = first renewal date in the planning model
- Why:
  - This creates a repeatable forecast line that can later be matched to actuals and tied back to the service and contract.

### Safety action
- Delete confirmation dialog
- Delete only lines that were entered in error. For real spend that stopped, prefer `cancelled` over deletion.

## 4) Services Workspace
### Overview
Track service lifecycle, risk, renewals, and replacement posture.

### Toolbar
- Search by service/vendor/owner
- Vendor filter
- Risk filter
- Risk filter is useful when prioritizing review work instead of scanning the full service inventory.

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
- Read the tabs from left to right when learning a service: what it is, what it costs, what it is contracted through, when it renews, and whether it has a replacement path.

### Create/Edit Service form
- Service name
- Vendor
- Owner
- Annual spend (minor units)
- Status (`active`, `trial`, `deprecated`, `retiring`, `retired`)
- Risk (`low`, `medium`, `high`)
- Replacement status (`not-started`, `candidate-review`, `approved`)

### Service field guidance
- Service name:
  - Use the product or capability name your team uses operationally.
  - Example: `Identity SSO` or `Cloud Platform`.
- Vendor:
  - Link the service to the supplier responsible for the product or hosted platform.
  - If the vendor is unknown, create/confirm the vendor record first so service reporting stays coherent.
- Owner:
  - Use the accountable team or function, not a rotating individual contributor whenever possible.
- Annual spend (minor units):
  - Store the annualized spend amount in minor units.
  - Example: `120000` means `$1,200.00`.
- Status:
  - `active`: normal live service.
  - `trial`: being evaluated, not yet part of standard operations.
  - `deprecated`: still present but should not be expanded.
  - `retiring`: active exit is underway.
  - `retired`: no longer in use.
  - New-user default: choose `active` unless the service is clearly in evaluation or retirement.
- Risk:
  - Use this for service-level concern, not just vendor sentiment.
  - `low`: stable ownership, acceptable lifecycle posture, no pressing renewal or reliability concern.
  - `medium`: some material concern exists and should stay visible in review.
  - `high`: active operational, security, cost, or lifecycle concern requiring prioritized action.
  - If uncertain, choose `medium` first.
- Replacement status:
  - `not-started`: no formal replacement work has begun.
  - `candidate-review`: alternatives are being evaluated.
  - `approved`: a replacement direction is agreed and execution planning can proceed.
  - Do not set `approved` just because the current service is unpopular; use it only when a real replacement direction has been accepted.

### Worked example
- Situation:
  - You run a central identity platform used by most employees.
- Reasonable first record:
  - Service name = `Identity SSO`
  - Vendor = `Okta`
  - Owner = `IT Operations`
  - Annual spend = annualized contract estimate
  - Status = `active`
  - Risk = `medium`
  - Replacement status = `not-started`
- Why:
  - The service is clearly live.
  - It is important enough that some level of risk visibility is warranted.
  - There is no approved replacement yet, so replacement should not be overstated.

### Safety action
- Delete confirmation dialog
- Delete only mistaken or duplicate service records.
- If a service is real but winding down, prefer lifecycle/status changes over deletion so history stays intact.

## 5) Contracts Workspace
### Overview
Manage contract terms, renewal windows, and linked services.

### Toolbar
- Search by contract/provider/owner
- Status filter (`active`, `renewal-window`, `notice-window`, `expired`)
- Use the status filter to work the contracts that need action first instead of browsing all agreements equally.

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
- The detail panel is where you confirm whether the contract record supports a keep, renegotiate, or exit decision.

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

### Contract field guidance
- Linked service:
  - Use the primary service governed by this agreement.
  - If the contract exists before the service record does, create the service record first so the contract has context.
- Contract number:
  - Use the identifier that appears in the agreement, procurement record, or vendor paperwork.
- Owner:
  - Use the person or team responsible for the commercial decision, not just the technical operator.
- Start date / End date:
  - Record the signed term dates from the agreement.
  - These dates drive downstream renewal and notice workflows.
- Renewal type:
  - `auto`: the agreement renews unless someone intervenes.
  - `manual`: the agreement requires a deliberate renewal decision.
  - `none`: no renewal path exists because the contract simply ends.
  - If you are unsure, check the legal language before choosing `auto`; it creates higher urgency for notice management.
- Renewal date:
  - Use the date the renewal decision or automatic renewal takes effect.
- Notice period days:
  - Use the contract's cancellation or non-renewal notice window in days.
  - Example: `30` means action must be taken at least 30 days before the renewal date.
- Lifecycle status:
  - `active`: agreement is live and not yet in an action window.
  - `renewal-window`: the contract is near enough to renewal to require active review.
  - `notice-window`: immediate action is needed to avoid an unwanted renewal or missed termination date.
  - `expired`: the term has ended.
  - New-user default: choose `active` unless dates clearly put the agreement into an action window already.
- Renewal action:
  - `auto-renew`: current expectation is to allow continuation.
  - `manual-review`: the business wants an explicit review before committing.
  - `cancel-window`: the team is actively considering or preparing exit/non-renewal.
  - Choose `manual-review` when you need a human decision and there is not yet a committed keep/cancel direction.

### Worked example
- Situation:
  - A SaaS agreement renews automatically every year unless cancelled 45 days early.
- Reasonable first record:
  - Renewal type = `auto`
  - Renewal date = contract renewal date from the agreement
  - Notice period days = `45`
  - Lifecycle status = `active` or `renewal-window` depending on timing
  - Renewal action = `manual-review`
- Why `manual-review`:
  - The contract may auto-renew mechanically, but the business still wants an explicit keep/change/cancel decision before that happens.

### Safety action
- Delete confirmation dialog
- Delete only incorrect or duplicate contract records. Historical agreements are usually better preserved than removed.

## 6) Vendors Workspace
### Overview
Manage vendor lifecycle with archive/delete guards.

### Toolbar
- Search by name, owner, or status
- Use search when you know the vendor name or accountable owner but not the exact row location.

### Table actions
- Review
- Edit
- Open services
- Open expenses
- Archive
- Delete
- `Open services` and `Open expenses` are the fastest way to verify whether a vendor is already driving spend in other workspaces.

### Detail panel
- Owner, annual spend, status, risk
- Linked services with quick open
- Linked contracts with quick open
- Use the detail panel to confirm whether the vendor record is only an address book entry or already tied to live planning objects.

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

### Vendor field guidance
- Vendor name:
  - Use the external supplier name your team would recognize in invoices, contracts, and escalation threads.
  - Avoid internal nicknames if the same vendor appears in agreements or exports under a formal name.
- Owner:
  - Use the person or team accountable for the relationship, not necessarily the daily user of the product.
  - Good default: the team that can answer renewal, cost, or risk questions.
- Annual spend (minor units):
  - BudgetIT stores currency in minor units.
  - Example: `50000` means `$500.00` in USD.
  - If you only know a rough number, use the best current annualized estimate and refine it later.
- Status:
  - `active`: use when the vendor is currently in use or under normal management.
  - `watch`: use when the relationship needs closer monitoring but is still live.
  - `archived`: use when the vendor should stay in history but no longer appear as an active planning record.
  - New-user default: choose `active` unless the relationship is intentionally being phased out or monitored.
- Risk:
  - `low`: low delivery, security, concentration, or renewal concern.
  - `medium`: some meaningful concern exists, but operations can continue without immediate intervention.
  - `high`: the vendor could materially disrupt cost, compliance, service delivery, or decision timing.
  - If you are unsure, start with `medium` and tighten later after review.
  - Use `high` when the vendor is single-source, overdue for review, tied to sensitive workloads, or repeatedly causing escalations.
- Linked service IDs / linked contract IDs:
  - Leave blank if those records do not exist yet.
  - Fill them in when you already know the related records and want the vendor detail view to act as a navigation hub.

### Worked example
- Situation:
  - Your team uses CrowdStrike for endpoint protection and expects to renew it next year.
- Reasonable first record:
  - Vendor name = `CrowdStrike`
  - Owner = `Security Operations`
  - Annual spend = `1850000` for `$18,500.00`
  - Status = `active`
  - Risk = `medium`
- Why `medium`:
  - The tool is important and worth watching, but you do not yet have evidence it is in immediate distress.
- What to do next:
  - Create the service it supports, then the contract, then the recurring expense line.

### Guardrails
- Archive can be blocked if already archived.
- Delete is blocked when linked services/contracts exist.
- Prefer `Archive` when you want to stop active use without destroying history.
- Use `Delete` only for cleanup of mistaken or duplicate records that are not linked elsewhere.

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

### Dimension field guidance
- Name:
  - Use a stable reporting concept such as `Cost Center`, `Environment`, `Department`, or `Region`.
  - Avoid names that describe temporary projects or overlapping concepts.
- Mode:
  - `single_select`: use when a record should have only one valid answer in that dimension.
  - `multi_select`: use when multiple tags may legitimately apply.
  - Good default:
    - `single_select` for Cost Center or Owner Team.
    - `multi_select` for capabilities, technologies, or cross-cutting labels.
- Required:
  - Turn on only when missing values should block trust in reporting or governance decisions.
  - New-user default: leave optional until the team has agreed on taxonomy and added usable tags.

### Worked examples
- Example 1: Cost Center
  - Name = `Cost Center`
  - Mode = `single_select`
  - Required = `yes`
  - Why:
    - most expense lines should belong to one accountable budget owner.
- Example 2: Environment
  - Name = `Environment`
  - Mode = `single_select`
  - Required = `yes` if reporting depends on Prod vs Non-Prod separation.
- Example 3: Capabilities
  - Name = `Capabilities`
  - Mode = `multi_select`
  - Required = `no`
  - Why:
    - one service or expense can legitimately support multiple business capabilities.

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
- Merge for duplicate meaning.
- Retire for valid historical values that should no longer be assigned going forward.

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

### Scenario action guidance
- Select:
  - Makes the scenario the active planning context for other workspaces.
- Clone:
  - Best starting point for a new planning cycle or alternative forecast.
  - Prefer cloning instead of editing baseline directly.
- Promote:
  - Move the scenario through process stages only when evidence and review are ready.
- Lock:
  - Prevents accidental edits after a scenario becomes decision-grade.
- Compare:
  - Use before review or approval to understand what changed and whether the changes are defensible.

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
- New-user default:
  - Stay in `draft` until the scenario is coherent and data quality gaps are resolved.
  - Move to `reviewed` when the scenario is ready for discussion.
  - Move to `approved` only when the team intends to rely on it for communication or execution.

### Worked example
- Baseline:
  - Current approved operating plan.
- New scenario:
  - `FY27 cloud optimization`
- Typical path:
  1. Clone baseline.
  2. Adjust cloud and software expense lines.
  3. Compare against baseline.
  4. Move to `reviewed` when the savings story and tradeoffs are clear.
  5. Move to `approved` only when leadership accepts it as the working plan.

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
- Start with `Due soon` unless you are doing historical review or handoff cleanup.

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
- `Review`:
  - Use when you need to inspect the issue before deciding.
- `Ack`:
  - Use only after a real action has been taken.
- `Snooze until +7d`:
  - Use when the issue is valid but intentionally deferred.
- `Open entity`:
  - Use when the fix lives in the source record rather than in the alert itself.

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

### Example triage
- Alert: contract renews in 20 days
- You still need business input
- Best next step:
  - open entity
  - confirm owner and renewal action
  - snooze only if a follow-up date is real and agreed

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

### Mode guidance
- `expenses`:
  - Use for planned or recurring budget lines you want BudgetIT to manage directly.
- `actuals`:
  - Use for observed transactions that should be matched back to planned spend.
- New-user default:
  - Start with `expenses` when building the planning baseline.
  - Use `actuals` after the baseline exists and reconciliation matters.

### Mapping step controls
- Template name
- Cloud template pack (`AWS CUR`, `Azure cost export`, `GCP billing export`)
- Use saved template
- Save template
- Enforce finance metadata
- Template library (refresh, use template, delete template)
- Template name:
  - Use when you want the mapping reused for future files with the same layout.
- Cloud template pack:
  - Use only when the source file is a known cloud billing export with predictable columns.
- Use saved template:
  - Turn on when the file layout already matches a stored mapping.
- Save template:
  - Turn on when the current mapping should become the standard for similar files later.
- Enforce finance metadata:
  - Use when imports must include finance reference fields such as GL or Cost Center before they are considered acceptable.

### Worked examples
- Example 1: importing planned expenses
  - Mode = `expenses`
  - Use saved template = on if finance already standardized the file layout
  - Save template = on if this will recur monthly or quarterly
- Example 2: importing cloud actuals
  - Mode = `actuals`
  - Cloud template pack = provider-specific pack if the export format is standard
  - Enforce finance metadata = on if reporting depends on GL or Cost Center quality before commit

### Preview step
- Accepted / Rejected / Duplicate counts
- Dedupe policy summary
- Row preview table
- Error review filter (`all`, `validation`, `duplicate`)
- Optional tagging suggestions
- `Accepted` means the row can proceed.
- `Rejected` means the row must be corrected or excluded.
- `Duplicate` means the file repeated data BudgetIT already considers the same within the run.
- Do not treat a clean preview as optional; it is the safest place to catch shape and mapping errors before commit.

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
- Start date / End date:
  - Use to match the reporting period your audience expects.
- Tag filter:
  - Use when the report should focus on a single cost center, department, or other tagged slice.
- Visualization toggles:
  - `Table`: use for auditability and row-level review.
  - `Chart`: use for trend communication.
  - `Gauge`: use for quick directional KPI framing.
  - `Narrative`: use for executive summary language.

### Export orchestration
1. Choose format
2. Confirm destination path
3. Preview report and queue export

### Format guidance
- `CSV`:
  - best for downstream analysis and spreadsheet work.
- `PDF`:
  - best for fixed-layout sharing.
- `Excel`:
  - best when the audience will keep working with the data.
- `HTML` or image-style outputs:
  - best for fast distribution or lightweight inspection.

### Worked examples
- Executive monthly review:
  - Preset = `Dashboard Overview`
  - Visualizations = Table + Chart + Narrative
  - Format = `PDF`
- Analyst follow-up:
  - Preset = `Spend by Vendor`
  - Visualizations = Table
  - Format = `CSV` or `Excel`

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

Example:
- Actual transaction arrives for a new recurring SaaS charge that was never planned.
- Correct disposition:
  - `Create expense`
  - because the issue is not bad source data; the plan is missing a real spend line.

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

### When to use NLQ
- Use NLQ when you know the question you want answered but do not want to manually configure a report first.
- Prefer standard Reports when you need repeatable stakeholder outputs with a fixed layout.
- Prefer Dashboard when you want a fast health check rather than an ad hoc query.

### Prompt construction pattern
- Preferred template:
  - Metric or question
  - Time window
  - Scope filters (scenario, vendor, tag, owner)
- Example:
  - "Show monthly variance for baseline in Q1 for cost center Security."

More examples:
- "Which vendors have the highest approved spend this quarter in baseline?"
- "Show replacement-required services for Infrastructure."
- "Compare monthly actual vs forecast for Security in the last 90 days."

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
- Prompt input:
  - Write the metric, time window, and scope in plain language.
  - If possible, include scenario and tag/vendor qualifiers explicitly.
- Save report name:
  - Use when the question is likely to become a repeated view for others.

### Failure handling
- No results:
  - Loosen overly specific filters.
  - Verify selected scenario contains expected records.
- Unexpected parse:
  - Use shorter, explicit prompt terms.
  - Re-run and inspect parsed filter explanation before export.

Practical advice:
- If the query feels conversational but the output is wrong, rewrite it as if you were giving instructions to an analyst:
  - metric
  - period
  - scope
  - scenario

## 13) Settings Center
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

## Concepts, Terms, And Decision Rules

### What BudgetIT Is Optimizing For
BudgetIT is not just a ledger. It is designed to help you answer:
- What are we paying for?
- Why are we paying for it?
- Who owns the decision?
- What changes if we renew, replace, defer, or cancel?

### Core Record Types
- Vendor:
  - The supplier or provider relationship.
  - Example: `AWS`, `Microsoft`, `Okta`
- Service:
  - The business or technical capability delivered by the vendor.
  - Example: `Cloud Platform`, `Endpoint Security`, `Identity SSO`
- Contract:
  - The agreement that controls dates, renewal behavior, notice windows, and ownership.
  - Example: `CTR-SSO-001`
- Expense:
  - The planned or realized spend line tied to a service, contract, or vendor context.
  - Example: `Identity SSO Annual Renewal`

### Common Status Terms
- `planned`:
  - Expected but not yet approved or committed.
- `approved`:
  - Intentionally accepted as part of the plan.
- `committed`:
  - Commercial or operational commitment exists.
- `actual`:
  - Spend has already occurred.
- `cancelled`:
  - The line should no longer be expected going forward.

### Risk Terms
- `low`:
  - Minimal current concern.
- `medium`:
  - Some material concern exists and should stay visible.
- `high`:
  - Requires active management because business, operational, security, or cost impact could be meaningful.

If you do not yet have a mature scoring framework, `medium` is the safest default until review is complete.

### Renewal Terms
- `renewal type`:
  - How the agreement renews (`auto`, `manual`, `none`).
- `renewal action`:
  - What the business currently intends to do (`auto-renew`, `manual-review`, `cancel-window`).
- `notice period days`:
  - How early action must be taken to avoid missing a termination or renewal decision point.

Example:
- Renewal type = `auto`
- Renewal action = `manual-review`
- Meaning: the contract will renew automatically unless the team actively decides otherwise in time.

### Replacement Terms
- `not-started`:
  - No formal replacement work exists yet.
- `candidate-review`:
  - Alternatives are being explored.
- `approved`:
  - A replacement direction has been accepted and can be executed.

Use replacement status to track transition readiness, not just dissatisfaction with the current tool.

### Tagging Terms
- `dimension`:
  - A classification category such as Cost Center, Environment, Department, or Region.
- `tag`:
  - A valid value inside that dimension.
- `single_select`:
  - Only one tag should apply.
- `multi_select`:
  - Multiple tags may apply.
- `required`:
  - Missing a value should be treated as a quality gap.

Example:
- Dimension: `Environment`
- Mode: `single_select`
- Tags: `Production`, `Non-Production`

### Scenario Terms
- `draft`:
  - Work in progress.
- `reviewed`:
  - Ready for stakeholder discussion.
- `approved`:
  - Accepted as operationally usable.
- `locked`:
  - Edits should stop unless there is an intentional unlock event.

### Reconciliation Terms
- `matched`:
  - Actuals linked to an expected occurrence.
- `unmatched`:
  - Actuals have no valid current match.
- `driver`:
  - The likely reason for mismatch.
  - `timing`: the spend happened earlier or later than expected.
  - `price`: the amount differs from plan.
  - `scope`: the underlying service or quantity changed.

Example:
- Forecast expected `$500`
- Actual arrived as `$650`
- Driver likely = `price`

### Reporting Terms
- `forecast`:
  - What the plan expects.
- `actual`:
  - What happened in reality.
- `variance`:
  - `actual - forecast`
- `tagging completeness`:
  - How much of the data is classified well enough to trust filtered reporting.
- `showback`:
  - A way to present cost responsibility back to teams or cost centers.

### Good Default Behavior When You Are Unsure
- Prefer preserving history over deleting records.
- Prefer `medium` risk over guessing `low`.
- Prefer `manual-review` over `auto-renew` when contract intent is unclear.
- Prefer leaving a dimension optional until taxonomy is agreed.
- Prefer fixing data quality before distributing executive reporting.

## End-To-End Example

### Scenario
Your company uses Okta for workforce identity. The contract renews annually. Leadership wants to understand current spend, renewal risk, and whether a lower-cost alternative should be evaluated next year.

### Records You Would Create
- Vendor:
  - Name = `Okta`
  - Owner = `Identity and Access Management`
  - Status = `active`
  - Risk = `medium`
- Service:
  - Name = `Workforce Identity`
  - Vendor = `Okta`
  - Status = `active`
  - Risk = `medium`
  - Replacement status = `candidate-review`
- Contract:
  - Contract number = `CTR-OKTA-2026`
  - Vendor/service linked
  - Renewal type = `auto`
  - Renewal action = `manual-review`
  - Notice period days = `60`
- Expense:
  - Name = `Okta Annual Renewal`
  - Amount = annual subscription value
  - Status = `approved`
  - Recurrence = annual

### Why Those Choices Make Sense
- `medium` risk:
  - The service is important and worth watching, but there is no confirmed disruption yet.
- `candidate-review` replacement status:
  - The business is exploring options, but no replacement has been approved.
- `manual-review` renewal action:
  - The contract may auto-renew mechanically, but the business still wants an intentional decision before that happens.
- `approved` expense status:
  - The budget expects the spend, even though the next invoice has not arrived yet.

### Suggested Tags
- Cost Center = `IT Operations`
- Department = `Security`
- Environment = `Production`

These tags let Reports, Dashboard slices, and showback outputs explain who owns the cost and where it matters.

### What You Should See Across The App
- Dashboard:
  - Forecast includes the planned renewal amount.
  - Renewals KPI should count the contract when it enters the upcoming window.
  - Replacement KPI should reflect that an alternative is under review.
- Alerts Inbox:
  - An alert should appear when the notice or renewal threshold is reached.
- Reports:
  - Spend by Vendor should show `Okta`.
  - Spend by Tag should show the assigned cost center and department.
- NLQ:
  - A question like `show approved identity expenses renewing this year` should find the record if the filters align.

### When Actuals Arrive
Suppose finance imports a payment for the Okta renewal:
- If the amount and timing match the expected annual line:
  - Match the transaction to the planned occurrence.
- If the amount is materially higher:
  - Match it, then mark the driver as `price`.
- If the payment arrives in a different month:
  - Match it, then mark the driver as `timing`.
- If the payment is for a second unplanned SKU:
  - Create a new expense instead of forcing a bad match.

### Scenario Comparison Example
Leadership wants to compare staying on Okta versus moving to a lower-cost alternative.

Baseline scenario:
- Keep `Okta Annual Renewal`
- Replacement status remains `candidate-review`

Draft scenario:
- Reduce future identity spend beginning next fiscal year
- Add migration-related one-time expense
- Change replacement status to `approved`
- Update narrative assumptions in review notes or export commentary

What a good comparison should explain:
- total spend change
- timing of the savings
- one-time migration cost
- operational risk introduced by the transition

### Good Modeling Choices
- Keep one vendor record for the supplier relationship.
- Use a separate service record for the business capability being delivered.
- Use the contract to hold the renewal mechanics.
- Use the expense to represent the budget line or realized transaction pattern.

### Bad Modeling Choices
- Putting renewal terms only in the expense and nowhere in the contract.
- Creating a new vendor for every invoice variation or SKU.
- Marking replacement as `approved` before a real decision exists.
- Setting risk to `low` only because the service is popular or familiar.

### What A New User Should Learn From This Example
- The app works best when one business capability is modeled as connected records, not disconnected rows.
- Status, risk, renewal, and replacement values should describe operational reality, not just fill required fields.
- Reports and alerts become much more useful after links and tags are in place.

## Common Mistakes And Good Practices

### Modeling The Wrong Thing
Common mistake:
- Using a vendor record when you really mean a service, or using a service when you really mean a contract.

Better practice:
- Vendor = who you buy from.
- Service = what capability you receive.
- Contract = what governs the dates and renewal mechanics.
- Expense = what money you expect or observe.

Quick test:
- If the answer is a company name, it is probably a vendor.
- If the answer is a capability or product family, it is probably a service.
- If the answer is an agreement number or term schedule, it is probably a contract.

### Choosing Statuses That Are Too Optimistic
Common mistake:
- Marking records as the lowest-risk or most-final status just to get through setup.

Better practice:
- Use `medium` risk when you do not yet have enough evidence for `low`.
- Use `planned` or `approved` instead of `actual` until money has truly landed.
- Use `manual-review` when renewal intent is still undecided.

Why this matters:
- BudgetIT is only as good as the operating signal in the statuses you assign.
- Optimistic statuses hide work that still needs attention.

### Deleting Records Too Early
Common mistake:
- Deleting records because they are no longer active.

Better practice:
- Archive historical records unless they were created by mistake and are safe to remove.
- Preserve history when it could explain old reports, prior contracts, or audit questions later.

### Mixing Planned Spend With Actuals
Common mistake:
- Editing planned expenses to mimic imported actuals instead of reconciling them.

Better practice:
- Keep the planned line as the expectation.
- Import actuals separately.
- Use reconciliation to explain timing, price, or scope differences.

Bad example:
- Changing the forecast amount every month just to make variance disappear.

Good example:
- Leave the forecast intact, import the invoice, then document that the difference was caused by price or timing.

### Forcing A Match In Reconciliation
Common mistake:
- Matching an actual transaction to the nearest expense even when it is clearly not the same thing.

Better practice:
- Match only when the business meaning is correct.
- Use `Create expense` when the transaction reveals a real missing line.
- Use `Reject` when the source row is invalid.
- Use `Ignore` only when there is a deliberate follow-up plan.

### Making Tags Required Too Soon
Common mistake:
- Turning on required dimensions before the tag list and ownership process are ready.

Better practice:
- Start optional.
- Create stable tags.
- Publish naming rules.
- Then enforce required tagging once users can succeed consistently.

Warning sign:
- Large missing-tag queues with no clear owner usually mean the taxonomy was enforced before it was operationally ready.

### Using Tags For What Should Be Separate Records
Common mistake:
- Encoding contract lifecycle, vendor identity, or service ownership purely as tags.

Better practice:
- Use tags for classification and slicing.
- Use vendors, services, contracts, and expenses for the primary business model.

Good use of tags:
- Cost Center, Region, Environment, Department

Poor use of tags:
- `contract-ending-soon`
- `vendor-okta`
- `replace-next-year`

### Treating Scenarios As Working Copies Without Governance
Common mistake:
- Editing whichever scenario is active without confirming whether it is the baseline or an approved view.

Better practice:
- Clone before experimenting.
- Compare before promoting.
- Lock scenarios when edits should stop.

New-user default:
- Do routine setup in `Baseline` only until the operating model is understood.
- Use draft scenarios for alternative plans, not for accidental everyday edits.

### Sending Reports Before Data Quality Is Ready
Common mistake:
- Exporting executive reports while unmatched actuals or missing required tags are still unresolved and unexplained.

Better practice:
- Review guardrails first.
- Clear high-impact reconciliation issues.
- Add commentary when some known exceptions remain.

Minimum safe check before sharing:
- You can explain major variance.
- Required tags are mostly complete.
- Renewal and replacement signals are not obviously stale.

### Treating Settings As Set-Once Configuration
Common mistake:
- Configuring settings once and assuming they never need review.

Better practice:
- Revisit notifications, backup verification, finance reference data, and planning horizon as the operating process matures.

Examples:
- Increase horizon months when replacement programs extend beyond one year.
- Re-test Teams notifications after endpoint or policy changes.
- Refresh finance reference lists before major import cycles.

### Good Defaults When You Are Not Sure
- Use `medium` risk.
- Use `manual-review` for unclear renewal intent.
- Keep records linked rather than isolated.
- Archive instead of delete when history may matter.
- Start with a simple tag model before enforcing broad governance.
- Use preview and validation steps before every import commit.

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

Example:
- Vendor: `CrowdStrike`
- Service: `Endpoint Protection`
- Contract: `CTR-CS-2026-01`
- Expense: `Endpoint Protection Annual Renewal`
- Suggested tags:
  - Cost Center = `Security`
  - Environment = `Production`

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

Example:
- Imported transaction: `AWS March invoice`
- Planned expense exists but actual landed one month late
- Suggested decision:
  - Match to the expected cloud expense occurrence
  - Driver = `timing`
  - Comment = `Invoice posted one cycle later than forecast`

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

Example:
- Report preset: `Dashboard Overview`
- Date range: first day to last day of the month
- Required visualizations: Table + Chart + Narrative
- Final check before sharing:
  - Unmatched actuals are reviewed
  - Missing required tags are understood or remediated

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

Example:
- Baseline includes one security tool
- Draft scenario replaces it with a lower-cost alternative
- Compare should explain:
  - reduced annual spend
  - contract timing changes
  - replacement status movement
  - any new risk introduced by the switch

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
