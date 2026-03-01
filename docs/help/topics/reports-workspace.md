Flexible reporting, export orchestration, and operational finance tools.

### Report gallery
- Open preset reports (Dashboard Overview, Renewals Pipeline, Spend by Tag/Vendor, Replacement Pipeline, Tagging Completeness)

### Workspace filters
- Start date
- End date
- Tag filter
- Visualization toggles:
  - Table
  - Chart
  - Gauge
  - Narrative

### Export orchestration
1. Choose format
2. Confirm destination path
3. Preview report and queue export

### Executive export playbook
1. Select a report preset aligned to the audience (`Dashboard Overview` for exec cadence).
2. Set reporting period filters and confirm Scenario context.
3. Keep required visualizations enabled (`Table`, `Chart`, `Gauge`, `Narrative`) for complete briefing.
4. Confirm destination and run preview before queueing.
5. Queue export in required format(s) and verify output path in export metadata.
6. Review Data Quality Guardrails and unresolved unmatched actuals before distribution.

### Additional reporting operations
- Save current view as report preset
- Export job history table
- Data Quality Guardrails summary
- Unmatched Actuals Review:
  - Suggested match
  - Driver + comment
  - Match / Reject / Ignore / Create expense
- Showback Statements:
  - Period filters
  - Group by (`cost_center`, `team`)
  - Generate statement
  - Export CSV/XLSX

### Unmatched actuals review
1. Confirm the queue summary (`unmatched count`, `unmatched amount`, `driver mix`).
2. Pick a suggested match when a valid occurrence exists.
3. Choose a driver (`timing`, `price`, `scope`) and add analyst comment when needed.
4. Apply one disposition per row:
   - `Match`: link to occurrence.
   - `Reject`: mark invalid source record.
   - `Ignore`: defer resolution for this cycle.
   - `Create expense`: open planned-line workflow from actuals evidence.

### Glossary: reconciliation statuses
- `No match selected`: queue item has not been routed to an occurrence yet.
- `Match`: transaction is reconciled against an existing planned line.
- `Reject`: transaction is excluded due to invalid source or business exclusion.
- `Ignore`: transaction remains unresolved intentionally for follow-up.
- `Create expense`: promotes unmatched signal into a new expense record candidate.

### Weekly operating checklist
- Refresh primary report preset(s) with current week filters.
- Review unmatched actuals queue and clear high-priority rows.
- Check data quality guardrails and assign fixes for missing metadata.
- Queue weekly export package and confirm artifact paths.

### Monthly operating checklist
- Run executive export playbook using month-end filters.
- Validate narrative block accuracy against KPI/trend signals.
- Generate showback statements for finance review.
- Archive/export run outputs and note unresolved reconciliation exceptions.
