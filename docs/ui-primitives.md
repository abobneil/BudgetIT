# UI Primitives

This project uses Fluent UI v9 for renderer components. Reusable primitives live under `apps/renderer/src/ui/primitives`.

## Usage Rules

- Use `PageHeader` for every routed page heading/subheading.
- Use `StatusChip` for discrete state labels (for example: planned, approved, snoozed, high severity).
- Use `EntityTable` for read/list views before introducing feature-specific table behavior.
- Use `FormDrawer` for create/edit workflows; avoid browser-native prompts.
- Use `ConfirmDialog` for destructive or irreversible actions.
- Use `InlineError` for recoverable panel-level failures.
- Use `EmptyState` when a list/report has no records.

## Theme

Theme tokens are centralized in `apps/renderer/src/ui/theme.ts`:

- `budgetItLightTheme`
- `budgetItDarkTheme`
- `budgetItHighContrastTheme`

All renderer pages should be nested under `FluentProvider`.
