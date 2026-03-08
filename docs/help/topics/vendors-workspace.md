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
