### Overview
Define taxonomy and enforce classification quality across expenses, reports, and allocations.

### Main capabilities
- Create dimensions:
  - Name
  - Mode (`single_select` or `multi_select`)
  - Required (`yes/no`)
- Create tags inside a dimension
- Retire tags
- Merge source tag into target tag
- Fix tagging queue for required dimensions

### Dimension design rules
- Keep dimensions stable and decision-oriented (example: Cost Center, Environment).
- Avoid duplicate semantics across dimensions.
- Mark as `required` only when missing values block downstream reporting decisions.

### Setup sequence for new dimensions
1. Create dimension and choose mode.
2. Add initial tags and publish naming guidance.
3. Mark required only after at least one valid tag exists.
4. Triage missing-tag queue created by requirement enforcement.

### Merge and retire safeguards
- Merge when consolidating synonyms or deprecated values.
- Retire when tag should stop being assigned to new records.
- Validate report/filter behavior after merge to ensure historical continuity.

### Queue triage playbook
1. Filter queue by highest-impact missing dimension first.
2. Assign tags to records with known ownership/context.
3. Route ambiguous rows back to workspace owner for decision.
4. Re-check completeness metrics after batch updates.

### Quality indicators
- Tag completeness percentage
- Queue count for missing required tags
- Suggested thresholds:
  - Green: >= 98% completeness
  - Watch: 95% to 97.9%
  - Action required: < 95%
