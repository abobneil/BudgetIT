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
