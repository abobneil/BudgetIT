Decision summary view for financial and operational signals.

### Main actions
- Change date window: `1m`, `3m`, `12m`, `60m`
- Refresh data
- Export dashboard (`HTML`, `PDF`, `Excel`, `CSV`, `PNG`)
- Edit layout (toggle card visibility, re-order cards, assign sections, add custom sections)
- Reset layout defaults

### Forecast KPI
- Definition: sum of forecast spend in the active scenario + selected window.
- Use: baseline expected spend for comparison against actuals.

### Actual KPI
- Definition: sum of observed/actual spend in the active scenario + selected window.
- Use: realized spend used for variance and trend analysis.

### Variance KPI
- Definition: `actual - forecast` for the active window aggregate.
- Positive variance (`> 0`): spend above forecast.
- Negative variance (`< 0`): spend under/within forecast.

### Renewals (Upcoming) KPI
- Definition: count of renewals in the selected window from renewals timeline data.
- Use: near-term operational workload signal.

### Tagging Completeness KPI
- Definition: `(tagged expense lines / total expense lines) * 100`.
- Use: data quality confidence indicator for reporting and allocations.

### Replacement Required KPI
- Definition: number of open replacement-required plans in current scenario.
- Use: highlights technical debt and lifecycle risk backlog.

### Spend Trend Card
- Shows monthly forecast vs actual bars for the selected window.
- Use to detect sustained spend drift, not single-point anomalies only.

### Variance Trend Card
- Shows monthly variance bars (`actual - forecast`) with directionality.
- Pair with Variance KPI for aggregate + monthly diagnostics.

### Renewals Timeline Card
- Shows renewal counts by month.
- Use to schedule owner follow-up and notice-period preparation.

### Growth Trend Card
- Shows month-over-month growth percentages.
- `N/A` means prior month baseline was unavailable/zero for growth calculation.

### Replacement Status Breakdown Card
- Shows count by replacement status category.
- Use to detect blocked/rework-heavy replacement pipelines.

### Narrative Insights
- Shows generated analyst summaries from report narrative blocks.
- Use for executive readouts after KPI/chart review.

### Variance triage workflow
1. Confirm scope: check selected Scenario and date window first.
2. Read aggregate signal: compare Forecast, Actual, and Variance KPIs.
3. Isolate timing: inspect Variance Trend by month to find spike periods.
4. Validate data quality: review Tagging Completeness and required-tag gaps.
5. Check operational drivers: review Renewals and Replacement status signals.
6. Assign next action:
   - Above forecast + valid data -> cost containment or reforecast update.
   - Above forecast + poor tagging -> fix metadata before executive reporting.
   - Under forecast + delayed renewals -> verify execution risk vs savings.

### Forecast freshness warning
- A stale forecast banner indicates data recency risk.
- Use **Open Settings** from the banner to reach maintenance controls.
