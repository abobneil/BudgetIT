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
