Guided import for expenses and actuals.

### 5 steps
1. Mode (`expenses` or `actuals`)
2. File (source path)
3. Mapping template
4. Preview
5. Commit

### Mapping step controls
- Template name
- Cloud template pack (`AWS CUR`, `Azure cost export`, `GCP billing export`)
- Use saved template
- Save template
- Enforce finance metadata
- Template library (refresh, use template, delete template)

### Preview step
- Accepted / Rejected / Duplicate counts
- Dedupe policy summary
- Row preview table
- Error review filter (`all`, `validation`, `duplicate`)
- Optional tagging suggestions

### Commit step
- Commit import
- Summary counts
- Actuals mode extras:
  - matched/unmatched counts
  - match rate
  - unmatched queue follow-up list

### Glossary: import statuses and match outcomes
- `accepted`: row passed validation and is eligible for insert/match processing.
- `rejected`: row failed validation and is excluded from commit.
- `duplicate`: row fingerprint matched an earlier row in the same run and is skipped.
- `matched`: actuals transaction linked to an existing expense occurrence.
- `unmatched`: transaction has no selected/valid occurrence match and requires queue review.
- `ignored`: unmatched transaction intentionally left unresolved for current cycle.

### Reconciliation playbook
1. Run preview and resolve validation/duplicate errors first.
2. Commit in `actuals` mode and review matched/unmatched counts.
3. Open unmatched queue follow-up items and decide one action per row:
   - Match to an existing occurrence.
   - Reject when source data is invalid.
   - Ignore when deferring to a later cycle.
   - Create expense when a new recurring/planned line is required.
