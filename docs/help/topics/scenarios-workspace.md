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
