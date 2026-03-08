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
