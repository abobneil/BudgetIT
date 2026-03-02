### Overview
Natural-language query interface for report-ready data retrieval with filter explainability.

### Main flow
- Enter prompt and run query
- Use example prompts
- Re-run from query history
- Review parsed filter spec explanation
- Review matched rows (sortable)
- Export results (`CSV` or `Excel`)
- Save as report preset

### Prompt construction pattern
- Preferred template:
  - Metric or question
  - Time window
  - Scope filters (scenario, vendor, tag, owner)
- Example:
  - "Show monthly variance for baseline in Q1 for cost center Security."

### Parsed filter review checklist
- Confirm date range interpretation.
- Confirm tag/vendor filters match intent.
- Confirm scenario context is correct before exporting.
- If parse is off, rewrite prompt with explicit constraints.

### Result validation checklist
- Spot-check top rows against known source records.
- Compare aggregates against Dashboard/Reports metrics.
- Flag major mismatches before sharing exported outputs.

### Inputs and actions
- Prompt input
- Export format + output directory
- Save report name

### Failure handling
- No results:
  - Loosen overly specific filters.
  - Verify selected scenario contains expected records.
- Unexpected parse:
  - Use shorter, explicit prompt terms.
  - Re-run and inspect parsed filter explanation before export.
