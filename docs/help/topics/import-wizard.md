Guided import for baseline inventory, expenses, and actuals.

### 5 steps
1. Mode (`baseline`, `expenses`, or `actuals`)
2. File (source path)
3. Mapping template
4. Preview
5. Commit

### Mode guidance
- `expenses`:
  - Use for planned or recurring budget lines you want BudgetIT to manage directly.
- `actuals`:
  - Use for observed transactions that should be matched back to planned spend.
- `baseline`:
  - Use for first-run or refresh intake of vendors, services, contracts, and linked expenses in one file.
  - Historical terms and renewal dates are allowed when they still matter for planning cycles.
  - Preview shows whether each entity will be created, updated, or left unchanged before commit.
- New-user default:
  - Start with `baseline` when loading the current inventory model for the first time.
  - Use `expenses` when you only need to add or revise planning lines after the baseline exists.
  - Use `actuals` after the baseline exists and reconciliation matters.

### Mapping step controls
- Template name
- Cloud template pack (`AWS CUR`, `Azure cost export`, `GCP billing export`)
- Use saved template
- Save template
- Enforce finance metadata
- Template library (refresh, use template, delete template)
- Baseline auto-mapping note:
  - `baseline` mode auto-detects common vendor/service/contract/expense headers and stages relational links during preview.
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
- Example 3: importing a baseline inventory workbook
  - Mode = `baseline`
  - Include vendor, service, contract, and expense columns in the same row set
  - Use preview to confirm create/update behavior before committing

### Preview step
- Accepted / Rejected / Duplicate counts
- Dedupe policy summary
- Row preview table
- Error review filter (`all`, `validation`, `duplicate`)
- Optional tagging suggestions
- `Accepted` means the row can proceed.
- `Rejected` means the row must be corrected or excluded.
- `Duplicate` means the file repeated data BudgetIT already considers the same within the run.
- `Upsert` means BudgetIT will update an existing linked entity instead of creating a duplicate vendor, service, contract, or expense.
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
