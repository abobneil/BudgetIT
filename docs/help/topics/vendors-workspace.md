### Overview
Manage vendor lifecycle with archive/delete guards.

### Toolbar
- Search by name, owner, or status

### Table actions
- Review
- Edit
- Open services
- Open expenses
- Archive
- Delete

### Detail panel
- Owner, annual spend, status, risk
- Linked services with quick open
- Linked contracts with quick open

### Create/Edit Vendor form
- Core details:
  - Vendor name
  - Owner
  - Annual spend (minor units)
  - Status (`active`, `watch`, `archived`)
  - Risk (`low`, `medium`, `high`)
- Linked records (optional):
  - Linked service IDs (CSV)
  - Linked contract IDs (CSV)

### Guardrails
- Archive can be blocked if already archived.
- Delete is blocked when linked services/contracts exist.

### Safety actions
- Archive confirmation dialog
- Delete confirmation dialog
