# BudgetIT Issue Implementation Plans

This document provides per-issue implementation plans corresponding to `ActionableIssues.md`.

## Implementation Template
Each issue plan contains:
1. Objective
2. Work breakdown
3. Definition of done
4. Test plan
5. Risks/mitigations

---

## ISSUE-001 — Electron + TypeScript Monorepo Bootstrap
1. **Objective**: Establish a stable baseline app architecture.
2. **Work breakdown**:
   - Create Electron main/preload/renderer packages.
   - Configure TS project references and path aliases.
   - Add ESLint/Prettier/Vitest/Playwright stubs.
   - Add config module for persisted settings.
3. **Definition of done**:
   - Dev startup and production build both run.
   - CI validates lint/typecheck/tests.
4. **Test plan**:
   - Smoke start app in dev/prod modes.
   - Unit test config read/write behavior.
5. **Risks/mitigations**:
   - Build-chain instability → pin core tool versions.

## ISSUE-002 — Tray + Auto-start + Lifecycle Controls
1. **Objective**: Ensure app can run headless in tray with user control.
2. **Work breakdown**:
   - Implement tray icon + context menu actions.
   - Wire close/minimize events to tray behavior.
   - Add login-item enable/disable logic.
   - Add settings UI toggles and persistence.
3. **Definition of done**:
   - Alerts continue after window close.
   - Exit action fully terminates app.
4. **Test plan**:
   - Lifecycle integration tests for close/minimize/exit.
   - Manual startup-at-login verification on Windows VM.
5. **Risks/mitigations**:
   - User confusion about hidden app → onboarding tooltip and clear Exit action.

## ISSUE-003 — Windows Installer (NSIS via electron-builder)
1. **Objective**: Provide reliable installation/uninstallation for Windows users.
2. **Work breakdown**:
   - Configure electron-builder metadata and NSIS target.
   - Add installer assets and default settings seed.
   - Document install/uninstall smoke steps.
3. **Definition of done**:
   - Installer artifacts generated in CI.
   - Fresh install and uninstall pass checklist.
4. **Test plan**:
   - Automated build pipeline for installer.
   - Manual install/uninstall and launch verification.
5. **Risks/mitigations**:
   - SmartScreen friction → add code-signing plan in release checklist.

## ISSUE-004 — Encrypted SQLite Integration
1. **Objective**: Establish encrypted local database foundation.
2. **Work breakdown**:
   - Integrate encrypted SQLite driver and connection wrapper.
   - Enforce PRAGMA key/rekey and WAL mode.
   - Create migration harness and baseline schema migration.
3. **Definition of done**:
   - Opening DB without key fails.
   - Migration runner supports upgrade path.
4. **Test plan**:
   - Integration tests for open/create/reopen DB with key.
   - PRAGMA assertions for encryption/WAL behavior.
5. **Risks/mitigations**:
   - Native module build failures → lock Node/Electron ABI matrix.

## ISSUE-005 — Key Management + Recovery Key Flow
1. **Objective**: Deliver secure auto-unlock with disaster recovery.
2. **Work breakdown**:
   - Implement first-run key setup UX.
   - Encrypt stored DB key with safeStorage.
   - Add recovery key export/import flow.
   - Implement key rotation and DB rekey operation.
3. **Definition of done**:
   - Normal reopen requires no repeated prompt.
   - Recovery path works on simulated migrated environment.
4. **Test plan**:
   - Unit tests for key envelope serialization.
   - Integration test for rekey and reopen.
5. **Risks/mitigations**:
   - Recovery-key mishandling → confirmation dialogs and one-time warning UX.

## ISSUE-006 — Core Schema + Domain Repositories
1. **Objective**: Encode core business model in typed storage layer.
2. **Work breakdown**:
   - Create schema migrations for core entities/tags/replacement/audit.
   - Implement repository classes with validation hooks.
   - Add domain DTOs and mapping utilities.
3. **Definition of done**:
   - CRUD APIs available for all core entities.
   - Constraints prevent invalid references/state.
4. **Test plan**:
   - Repository unit tests for create/update/delete/query.
   - Constraint tests for invalid inputs and transitions.
5. **Risks/mitigations**:
   - Schema drift across agents → migration naming convention + schema reviews.

## ISSUE-007 — Forecast Materialization Engine
1. **Objective**: Generate reliable projected occurrences for planning/reporting.
2. **Work breakdown**:
   - Implement recurrence interpreter and occurrence generator.
   - Add materialized table and refresh APIs.
   - Track last materialization vs mutation timestamps.
3. **Definition of done**:
   - Forecast output deterministic for fixed inputs.
   - Staleness flags available to UI/reporting.
4. **Test plan**:
   - Golden tests for recurrence edge cases.
   - Performance test for large occurrence windows.
5. **Risks/mitigations**:
   - Date logic bugs → timezone-normalized UTC strategy.

## ISSUE-008 — Alert Rules Engine + Snooze/Ack/Dedupe
1. **Objective**: Deliver high-signal, low-noise alerting in background mode.
2. **Work breakdown**:
   - Implement scheduled rule evaluator.
   - Create alert-event state machine.
   - Add snooze windows and dedupe fingerprinting.
3. **Definition of done**:
   - Required alert families all emit events.
   - Duplicate suppression works over repeated scheduler runs.
4. **Test plan**:
   - Rule-evaluation integration tests.
   - Time-travel tests for snooze/ack behavior.
5. **Risks/mitigations**:
   - Alert spam → conservative dedupe defaults and configurable thresholds.

## ISSUE-009 — Teams Webhook Channel
1. **Objective**: Add optional external channel for high-priority notifications.
2. **Work breakdown**:
   - Build Teams webhook settings page.
   - Implement send-test and delivery client.
   - Add retry policy and failure telemetry.
3. **Definition of done**:
   - User can validate endpoint with test payload.
   - Failures visible in alert/channel diagnostics.
4. **Test plan**:
   - Mock webhook integration tests.
   - Contract tests for payload rendering.
5. **Risks/mitigations**:
   - API format shifts → isolate payload adapters behind interface.

## ISSUE-010 — CSV/XLSX Import Wizard + Validation
1. **Objective**: Make high-volume data intake safe and user-friendly.
2. **Work breakdown**:
   - Build stepper UI: upload → map → preview → import.
   - Add schema validation and normalization.
   - Implement row-level error reporting and dedupe checks.
3. **Definition of done**:
   - Imports complete with transparent validation feedback.
   - Invalid rows quarantined with actionable reasons.
4. **Test plan**:
   - Parser tests for CSV/XLSX variants.
   - UI tests for mapping and error handling.
5. **Risks/mitigations**:
   - Source format variance → reusable mapping presets.

## ISSUE-011 — Tag Automation Rules + Learning Loop
1. **Objective**: Minimize repeated manual tagging over time.
2. **Work breakdown**:
   - Implement deterministic matching rules.
   - Track repeated manual corrections.
   - Add rule-suggestion and approval workflow.
3. **Definition of done**:
   - Auto-tag pass runs during imports.
   - Suggested rules can be accepted in one click.
4. **Test plan**:
   - Rule-engine unit tests.
   - Regression tests with historical import fixtures.
5. **Risks/mitigations**:
   - Over-aggressive automation → confidence thresholds and review queue.

## ISSUE-012 — Reporting Engine + Narrative Templates
1. **Objective**: Deliver reusable analytical reports and narrative outputs.
2. **Work breakdown**:
   - Implement query builder with dimension filtering.
   - Build core report definitions and chart data mappers.
   - Add narrative template renderer.
3. **Definition of done**:
   - Core reports available and parameterizable.
   - Narrative report output reflects selected filters/timeframes.
4. **Test plan**:
   - Snapshot tests for report datasets.
   - Template rendering tests with edge-case values.
5. **Risks/mitigations**:
   - Report inconsistency → centralized metric definitions.

## ISSUE-013 — Multi-format Export Pipeline
1. **Objective**: Export reports to required formats with fidelity and controls.
2. **Work breakdown**:
   - Implement HTML package generator.
   - Add PDF/PNG capture flows.
   - Add Excel/CSV export adapters.
   - Add export scope selector (report vs raw).
3. **Definition of done**:
   - All formats export from report UI.
   - Export metadata includes generation timestamp/filter context.
4. **Test plan**:
   - Golden-file export comparisons.
   - File-open validation for xlsx/pdf/png/html outputs.
5. **Risks/mitigations**:
   - Layout drift in PDF/PNG → dedicated print layout components.

## ISSUE-014 — Backup/Restore with Manifest + As-Of UX
1. **Objective**: Guarantee recoverable backups with explicit data currency.
2. **Work breakdown**:
   - Implement backup command and manifest writer.
   - Add checksum generation/verification.
   - Build restore workflow and as-of status banner.
3. **Definition of done**:
   - Backup produces DB + manifest pair.
   - Restore confirms and displays source_last_mutation_at.
4. **Test plan**:
   - Backup/restore integration tests on encrypted DB.
   - Manifest schema validation tests.
5. **Risks/mitigations**:
   - Partial backups on network issues → temp-file then atomic rename.

## ISSUE-015 — Backup Verification + Target Health Monitoring
1. **Objective**: Improve confidence in backup reliability over time.
2. **Work breakdown**:
   - Add scheduled test-restore mode to temp location.
   - Add destination health probes and freshness checks.
   - Wire failures into alert engine.
3. **Definition of done**:
   - Verification status visible in operations dashboard.
   - Stale/unreachable backup alerts fire correctly.
4. **Test plan**:
   - Simulated unreachable target tests.
   - Verification pass/fail integration tests.
5. **Risks/mitigations**:
   - Extra IO overhead → configurable verification cadence.

## ISSUE-016 — Attachments + Encrypted File Store
1. **Objective**: Support evidence files tied to budget entities.
2. **Work breakdown**:
   - Add attachment metadata tables and APIs.
   - Implement encrypted blob/file store.
   - Integrate attachment backup/restore behavior.
3. **Definition of done**:
   - Attachments can be upload/downloaded from entity views.
   - Restored attachments remain decryptable and intact.
4. **Test plan**:
   - Round-trip encryption/decryption tests.
   - Backup restore tests with attachment sets.
5. **Risks/mitigations**:
   - Large-file performance → streaming encryption and size limits.

## ISSUE-017 — Budget Lifecycle Controls
1. **Objective**: Add governance features for planning periods and scenarios.
2. **Work breakdown**:
   - Implement snapshot/lock metadata and write guards.
   - Add scenario model and status transitions.
   - Expose governance controls in UI and reporting filters.
3. **Definition of done**:
   - Locked periods protected from edits.
   - Scenario status changes audited.
4. **Test plan**:
   - Permission/state-transition tests.
   - Scenario comparison report tests.
5. **Risks/mitigations**:
   - UX complexity → guided workflows and inline explanations.

## ISSUE-018 — Actuals Ingestion + Variance Reporting
1. **Objective**: Compare plan forecasts against real spend.
2. **Work breakdown**:
   - Add actuals import model and mapping workflow.
   - Build variance metric calculations.
   - Add variance dashboards and drill-downs.
3. **Definition of done**:
   - Actuals appear alongside forecast metrics.
   - Variance output available by key dimensions.
4. **Test plan**:
   - Calculation correctness tests.
   - End-to-end tests from import to variance view.
5. **Risks/mitigations**:
   - Mapping ambiguity → reconciliation queue and manual overrides.

## ISSUE-019 — Data Integrity Rules + Audit Experience
1. **Objective**: Increase trust via strict validation and visibility of changes.
2. **Work breakdown**:
   - Implement domain validation engine.
   - Add integrity check command/UI endpoint.
   - Build audit timeline view for critical fields.
3. **Definition of done**:
   - Invalid records blocked before commit.
   - Audit history available for key entities.
4. **Test plan**:
   - Validation rule unit tests.
   - Audit event generation and rendering tests.
5. **Risks/mitigations**:
   - False-positive validation failures → rule severity levels (warn/error).

## ISSUE-020 — End-to-End Quality Gate + Release Readiness
1. **Objective**: Ensure each release is stable, performant, and operationally safe.
2. **Work breakdown**:
   - Build full-journey integration suite.
   - Add scheduler resource usage benchmarks.
   - Finalize release checklist including signing guidance.
3. **Definition of done**:
   - Required regression suite passes before release.
   - Release checklist completed and archived.
4. **Test plan**:
   - CI matrix with smoke + integration + perf checks.
   - Installer validation on clean VM.
5. **Risks/mitigations**:
   - Flaky E2E tests → stable fixtures, retries, and test isolation.

---

## Suggested Cross-Agent Execution Order
1. Foundation: ISSUE-001, ISSUE-004.
2. Security/data core: ISSUE-005, ISSUE-006.
3. Runtime behavior: ISSUE-002, ISSUE-007.
4. Core product loops: ISSUE-008, ISSUE-010, ISSUE-012, ISSUE-014.
5. Channels/exports/automation: ISSUE-009, ISSUE-011, ISSUE-013.
6. Hardening and advanced capability: ISSUE-015 through ISSUE-020.
