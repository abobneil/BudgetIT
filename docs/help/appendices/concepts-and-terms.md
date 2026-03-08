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
