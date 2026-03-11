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
- Start renewal review:
  - Opens the Renewal Workbench for the active scenario.
  - Record the intended action, effective date, expected future cost, and planning notes before saving.
  - Saving a decision updates scenario forecast inputs so downstream comparison reflects the planned renewal outcome.
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
