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
