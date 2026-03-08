Guided import for expenses and actuals.

### 5 steps
1. Mode (`expenses` or `actuals`)
2. File (source path)
3. Mapping template
4. Preview
5. Commit

### Mode guidance
- `expenses`:
  - Use for planned or recurring budget lines you want BudgetIT to manage directly.
- `actuals`:
  - Use for observed transactions that should be matched back to planned spend.
- New-user default:
  - Start with `expenses` when building the planning baseline.
  - Use `actuals` after the baseline exists and reconciliation matters.

### Mapping step controls
- Template name
- Cloud template pack (`AWS CUR`, `Azure cost export`, `GCP billing export`)
- Use saved template
- Save template
- Enforce finance metadata
- Template library (refresh, use template, delete template)
- Template name:
  - Use when you want the mapping reused for future files with the same layout.
- Cloud template pack:
  - Use only when the source file is a known cloud billing export with predictable columns.
- Use saved template:
  - Turn on when the file layout already matches a stored mapping.
- Save template:
  - Turn on when the current mapping should become the standard for similar files later.
- Enforce finance metadata:
  - Use when imports must include finance reference fields such as GL or Cost Center before they are considered acceptable.

### Worked examples
- Example 1: importing planned expenses
  - Mode = `expenses`
  - Use saved template = on if finance already standardized the file layout
  - Save template = on if this will recur monthly or quarterly
- Example 2: importing cloud actuals
  - Mode = `actuals`
  - Cloud template pack = provider-specific pack if the export format is standard
  - Enforce finance metadata = on if reporting depends on GL or Cost Center quality before commit

### Preview step
- Accepted / Rejected / Duplicate counts
- Dedupe policy summary
- Row preview table
- Error review filter (`all`, `validation`, `duplicate`)
- Optional tagging suggestions
- `Accepted` means the row can proceed.
- `Rejected` means the row must be corrected or excluded.
- `Duplicate` means the file repeated data BudgetIT already considers the same within the run.
- Do not treat a clean preview as optional; it is the safest place to catch shape and mapping errors before commit.

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
