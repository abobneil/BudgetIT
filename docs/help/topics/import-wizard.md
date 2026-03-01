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
