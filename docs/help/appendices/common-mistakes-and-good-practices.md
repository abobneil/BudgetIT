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
