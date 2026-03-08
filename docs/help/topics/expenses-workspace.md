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
