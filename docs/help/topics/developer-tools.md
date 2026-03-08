### Overview
Developer Tools is no longer a full product workspace. It exists as a narrow diagnostic landing page for local development and verification.

### What remains
- Confirmation that the legacy monolithic workspace is retired.
- Guidance to use the routed workspaces for shipped BudgetIT functionality.
- Guidance to use package scripts and test commands for diagnostics.

### Recommended actions
- Use routed workspaces (`Dashboard`, `Expenses`, `Services`, `Contracts`, `Vendors`, `Tags`, `Scenarios`, `Alerts`, `Import`, `Reports`, `NLQ`, `Settings`) for app behavior checks.
- Use repo commands for diagnostics:
  - `npm run test`
  - `npm run help:check`
  - package-scoped test/build commands as needed

### Common confusion
- Looking for the old all-in-one workspace:
  - It has been retired from the shipped shell.
  - Use the routed workspaces instead.
- Looking for product help from this page:
  - Open Help and jump directly to the routed workspace you are validating.
