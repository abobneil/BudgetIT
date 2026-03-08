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

### When to use NLQ
- Use NLQ when you know the question you want answered but do not want to manually configure a report first.
- Prefer standard Reports when you need repeatable stakeholder outputs with a fixed layout.
- Prefer Dashboard when you want a fast health check rather than an ad hoc query.

### Prompt construction pattern
- Preferred template:
  - Metric or question
  - Time window
  - Scope filters (scenario, vendor, tag, owner)
- Example:
  - "Show monthly variance for baseline in Q1 for cost center Security."

More examples:
- "Which vendors have the highest approved spend this quarter in baseline?"
- "Show replacement-required services for Infrastructure."
- "Compare monthly actual vs forecast for Security in the last 90 days."

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
- Prompt input:
  - Write the metric, time window, and scope in plain language.
  - If possible, include scenario and tag/vendor qualifiers explicitly.
- Save report name:
  - Use when the question is likely to become a repeated view for others.

### Failure handling
- No results:
  - Loosen overly specific filters.
  - Verify selected scenario contains expected records.
- Unexpected parse:
  - Use shorter, explicit prompt terms.
  - Re-run and inspect parsed filter explanation before export.

Practical advice:
- If the query feels conversational but the output is wrong, rewrite it as if you were giving instructions to an analyst:
  - metric
  - period
  - scope
  - scenario
