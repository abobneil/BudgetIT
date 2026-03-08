# BudgetIT Session Handoff

Date: 2026-03-05

## What was completed in these sessions

### 1) Legacy `/developer` surface isolated
- `apps/renderer/src/features/developer/DeveloperToolsPage.tsx`
- `/developer` no longer renders the legacy monolithic `App.tsx` surface.
- It now shows a limited placeholder/diagnostic page so the routed workspaces remain canonical.

### 2) Scenario consistency improved in renderer
- `apps/renderer/src/features/services/ServicesPage.tsx`
- `apps/renderer/src/features/contracts/ContractsPage.tsx`
- `apps/renderer/src/features/scenarios/ScenariosPage.tsx`
- Services/contracts now use `selectedScenarioId` for expense overlays instead of hardcoded `"baseline"`.
- Scenario comparison in `ScenariosPage` now derives the baseline/root scenario id from scenario state instead of hardcoding it in the page.

### 3) Runtime date defaults made dynamic
- Added `apps/renderer/src/lib/dateDefaults.ts`
- Updated:
  - `apps/renderer/src/features/services/ServicesPage.tsx`
  - `apps/renderer/src/features/contracts/ContractsPage.tsx`
  - `apps/renderer/src/features/reports/ReportsPage.tsx`
- Report ranges and reference dates now derive from runtime UTC dates instead of hardcoded `2026-*` values.

### 4) Persistence / backup reconciliation advanced
- `apps/renderer/src/features/scenarios/scenario-model.ts`
- `apps/renderer/src/features/scenarios/scenario-model.test.ts`
- `apps/renderer/src/features/settings/SettingsPage.tsx`
- Added:
  - `apps/renderer/src/lib/machineLocalState.ts`
  - `apps/renderer/src/lib/machineLocalState.test.ts`
- Scenario localStorage persistence was reduced to only `selectedScenarioId`.
- Full scenario records are no longer persisted outside the DB-backed model.
- Renderer machine-local UI state is now explicitly reconciled after restore.
- After restore, the app clears the renderer-only machine-local state once per restore token so stale local UI preferences do not survive a database restore.
- Currently reconciled machine-local state:
  - dashboard layout
  - saved report presets
  - NLQ history
  - quick-start checklist progress
- Restore reconciliation is wired in both:
  - `apps/renderer/src/features/settings/SettingsPage.tsx`
  - `apps/renderer/src/app/AppShell.tsx`

### 5) Native file/folder dialogs added
- `packages/core/src/ipc.ts`
- `apps/desktop/src/preload.ts`
- `apps/desktop/src/main.ts`
- `apps/renderer/src/lib/ipcClient.ts`
- Added IPC channels:
  - `dialog.pickFile`
  - `dialog.pickDirectory`
- Browse flows added to:
  - `apps/renderer/src/features/import/ImportPage.tsx`
  - `apps/renderer/src/features/settings/SettingsPage.tsx`
  - `apps/renderer/src/features/reports/ReportsPage.tsx`
  - `apps/renderer/src/features/nlq/NlqPage.tsx`

### 6) Global search + deep-linking improved
- Added `apps/renderer/src/app/entity-routes.ts`
- Updated `apps/renderer/src/app/AppShell.tsx`
- Updated:
  - `apps/renderer/src/features/vendors/VendorsPage.tsx`
  - `apps/renderer/src/features/expenses/ExpensesPage.tsx`
- Global search now uses live IPC-backed entity data when IPC is available.
- Falls back to fixture search entries when IPC is unavailable.
- Added canonical route builders for vendor/service/contract/expense links.
- Expense deep links now carry scenario context in the URL.

### 7) Backend scenario contract tightened
- `apps/desktop/src/main.ts`
- `apps/desktop/src/main.test.ts`
- `apps/renderer/src/lib/ipcClient.ts`
- `apps/renderer/src/features/reports/ReportsPage.tsx`
- Explicit `scenarioId` is now required for scenario-sensitive main-process/reporting paths instead of silently falling back to `"baseline"`.
- Tightened handlers/parsers include:
  - `parseReportsQueryPayload`
  - `parseExportReportPayload`
  - `parseReportPreviewPayload`
  - unmatched actuals payload parsing
  - scenario settings payload parsing
  - showback generation payload parsing
  - expense create/update payload parsing
- `scenario.comparison` now requires explicit `baselineScenarioId`.
- `replacement.detail` now validates that the requested `scenarioId` matches the service plan's scenario.
- `actuals.unmatched.review` and `actuals.unmatched.createExpense` now reject scenario/transaction mismatches.
- There are no remaining `"baseline"` fallbacks in `apps/desktop/src/main.ts`.

### 8) Legacy monolith removed
- Deleted `apps/renderer/src/App.tsx`
- `/developer` had already stopped using it; the dead file is now gone from the repo.

### 9) Test coverage improved
- `apps/desktop/src/main.test.ts`
  - added coverage for the tightened scenario contract
  - added dialog payload parser coverage
- `apps/desktop/src/preload.test.ts`
  - asserts new dialog channels are allowlisted
- `packages/core/src/ipc.test.ts`
  - asserts dialog channels are included in the IPC allowlist
- `apps/renderer/src/features/settings/SettingsPage.test.tsx`
  - now verifies restore reconciliation clears machine-local dashboard layout state

### 10) Documentation updated
- `README.md`
- `docs/operations-runbook.md`
- Documented:
  - what encrypted backups cover
  - what remains machine-local
  - that renderer machine-local UI state is reset after restore
  - which workflows now support browse dialogs

### 11) Renderer browse-button test coverage completed
- Updated:
  - `apps/renderer/src/features/import/ImportPage.test.tsx`
  - `apps/renderer/src/features/settings/SettingsPage.test.tsx`
  - `apps/renderer/src/features/reports/ReportsPage.test.tsx`
  - `apps/renderer/src/features/nlq/NlqPage.test.tsx`
- Added direct assertions that browse buttons call the expected dialog helpers and populate the selected paths.
- Settings tests now also avoid ScenarioProvider IPC noise by mocking `listScenarios` and keeping IPC disabled except where browse behavior is explicitly under test.

### 12) Legacy `App.css` audit completed
- Updated `apps/renderer/src/App.css`
- Removed dead selectors left behind by the deleted monolithic `App.tsx`, including:
  - `.app-shell`
  - `.settings-panel` and nested rules
  - `.status`
  - `.crud-grid`
  - `.crud-card` and nested rules
  - `.crud-form`
  - legacy global `h1` / `p` resets
- Kept shared/root/theme/base styles still used by the routed app shell.

### 13) Browser storage handling centralized further
- Added:
  - `apps/renderer/src/lib/browserStorage.ts`
  - `apps/renderer/src/lib/browserStorage.test.ts`
- Updated:
  - `apps/renderer/src/lib/machineLocalState.ts`
  - `apps/renderer/src/features/dashboard/dashboard-model.ts`
  - `apps/renderer/src/features/reports/reports-config-model.ts`
  - `apps/renderer/src/features/nlq/nlq-history-model.ts`
  - `apps/renderer/src/features/scenarios/scenario-model.ts`
  - `apps/renderer/src/features/help/HelpPage.tsx`
- `window.localStorage` resolution and JSON read/write/parsing are now centralized in one helper layer.
- This does **not** change product behavior yet, but it reduces duplicated localStorage boilerplate and makes any future persistence migration easier.

### 14) AppShell global-search coverage added
- Updated:
  - `apps/renderer/src/app/app-shell.test.tsx`
- Added renderer tests that now verify:
  - fallback global-search entries are used when IPC is unavailable
  - live IPC-backed global-search entries load when IPC is available
  - vendor/service/contract results navigate with the canonical builders from `entity-routes.ts`
  - expense results deep-link with the active scenario in the route

### 15) Machine-local UI-state decision finalized
- Updated:
  - `apps/renderer/src/lib/machineLocalState.ts`
  - `apps/renderer/src/lib/machineLocalState.test.ts`
  - `apps/renderer/src/features/settings/SettingsPage.tsx`
  - `README.md`
  - `docs/operations-runbook.md`
- Finalized decision:
  - dashboard layout remains machine-local
  - saved report presets remain machine-local
  - NLQ history remains machine-local
  - quick-start checklist progress remains machine-local
- This is now explicit in code/docs as an intentional product choice rather than an unresolved interim state.
- The policy also documents scope/behavior for each bucket (device vs profile scope, excluded from backup coverage, cleared after restore).

### 16) Scenario-contract audit advanced further
- Updated:
  - `apps/desktop/src/main.ts`
  - `apps/desktop/src/main.test.ts`
  - `apps/renderer/src/lib/ipcClient.ts`
- Tightened additional scenario-sensitive paths:
  - `expenses.list` now requires explicit `scenarioId`
  - `approvals.list` now requires explicit `scenarioId`
  - `approvals.create` now requires explicit `scenarioId`
  - renderer IPC typings for `createExpense` / `updateExpense` now also require explicit `scenarioId`
- Confirmed intentionally-optional behavior remains for:
  - `showback.list` scenario filtering
- Added parser coverage for the tightened payloads and the intentionally optional `showback.list` case.

## Validation completed
### Earlier session validation
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅

### Follow-up renderer validation after browse/CSS/storage cleanup
- `npm run typecheck --workspace @budgetit/renderer` ✅
- `npm run lint --workspace @budgetit/renderer` ✅
- `npm run test --workspace @budgetit/renderer` ✅

### Additional renderer validation after AppShell global-search tests
- `npm run test --workspace @budgetit/renderer -- app-shell.test.tsx` ✅
- `npm run typecheck --workspace @budgetit/renderer` ✅
- `npm run lint --workspace @budgetit/renderer` ✅
- `npm run test --workspace @budgetit/renderer` ✅

### Additional renderer validation after machine-local policy finalization
- `npm run typecheck --workspace @budgetit/renderer` ✅
- `npm run lint --workspace @budgetit/renderer` ✅
- `npm run test --workspace @budgetit/renderer` ✅

### Additional validation after follow-up scenario-contract tightening
- `npm run test --workspace @budgetit/desktop -- main.test.ts` ✅
- `npm run typecheck --workspace @budgetit/desktop` ✅
- `npm run lint --workspace @budgetit/desktop` ✅
- `npm run test --workspace @budgetit/desktop` ✅
- `npm run typecheck --workspace @budgetit/renderer` ✅
- `npm run lint --workspace @budgetit/renderer` ✅
- `npm run test --workspace @budgetit/renderer` ✅

### Full-repo validation after the latest follow-up work
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm run test` ✅

## Important files added
- `apps/renderer/src/lib/dateDefaults.ts`
- `apps/renderer/src/app/entity-routes.ts`
- `apps/renderer/src/lib/machineLocalState.ts`
- `apps/renderer/src/lib/machineLocalState.test.ts`
- `apps/renderer/src/lib/browserStorage.ts`
- `apps/renderer/src/lib/browserStorage.test.ts`

## Important files removed
- `apps/renderer/src/App.tsx`

## Remaining work

### A. Optional follow-up audit for scenario semantics outside the completed sweep
The main baseline fallback sweep is done, and one additional pass tightened `expenses.list` plus approval paths while confirming `showback.list` remains intentionally optional.

Possible remaining follow-ups, if desired:
- confirm whether any other list-style/global IPC endpoints should stay intentionally optional
- decide whether any non-reporting scenario-adjacent handlers should reject missing scenario context more aggressively
- if semantics change, update renderer typings/tests accordingly

This is now low priority because the main scenario-contract tightening work is already complete and passing.

## Notes for the next session
- Earlier in these sessions, the full repo passed `npm run typecheck`, `npm run lint`, and `npm test`.
- In the most recent follow-up work, the desktop and renderer workspaces passed their targeted/full validation after the AppShell global-search, machine-local-policy, and follow-up scenario-contract updates.
- No commit was created in these sessions.
- The working tree still contains other uncommitted changes from the broader workspace work; inspect `git status` before continuing.
- The highest-value remaining work is:
  1. optionally audit any remaining low-priority scenario-semantics edges outside the completed sweep

## Quick resume prompt
If starting a new session, use something like:

> Read `SESSION_HANDOFF.md`, inspect the current uncommitted changes, then optionally audit any remaining low-priority scenario-semantics edges while preserving passing tests.
