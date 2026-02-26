# BudgetIT Actionable Issue Backlog (Parallel-Agent Ready)

This backlog breaks the final plan (`FourReply.md`) into implementation-ready issues with explicit dependencies and parallelization lanes.

## Legend
- **Priority**: P0 (foundational), P1 (core features), P2 (polish/expansion)
- **Agent Lane**: Suggested ownership for parallel workstreams
- **Depends on**: Hard dependencies that should be complete first
- **Deliverable**: Objective completion artifact

---

## Lane A — Platform & App Shell

### ISSUE-001 — Electron + TypeScript Monorepo Bootstrap
- **Priority**: P0
- **Agent Lane**: A
- **Depends on**: none
- **Scope**:
  - Initialize Electron desktop app (main/preload/renderer TypeScript)
  - Configure React + Vite renderer
  - Add lint/format/typecheck/test scaffolding
  - Define env config and app settings persistence
- **Acceptance Criteria**:
  - App launches window in dev + packaged mode
  - CI tasks run (`lint`, `typecheck`, `test`, `build`)
  - Basic settings read/write works
- **Deliverable**: Running shell app + repository standards

### ISSUE-002 — Tray + Auto-start + Lifecycle Controls
- **Priority**: P0
- **Agent Lane**: A
- **Depends on**: ISSUE-001
- **Scope**:
  - Add tray icon/menu with Show, Snooze All, Exit
  - Enable startup at login by default
  - Implement “close to tray” behavior and explicit Exit flow
  - Add settings toggles for startup/tray behavior
- **Acceptance Criteria**:
  - Closing main window keeps background process alive
  - Start-with-Windows configurable in Settings
  - Exit cleanly terminates process and scheduler
- **Deliverable**: Production-ready app lifecycle behavior

### ISSUE-003 — Windows Installer (NSIS via electron-builder)
- **Priority**: P1
- **Agent Lane**: A
- **Depends on**: ISSUE-001
- **Scope**:
  - Configure electron-builder NSIS target
  - Add first-run defaults for startup/tray settings
  - Add installer/uninstaller smoke-test checklist
- **Acceptance Criteria**:
  - Installer and uninstaller complete successfully on Windows
  - App updates settings defaults on first run
- **Deliverable**: Installable distributable artifact

---

## Lane B — Data Foundation & Security

### ISSUE-004 — Encrypted SQLite Integration
- **Priority**: P0
- **Agent Lane**: B
- **Depends on**: ISSUE-001
- **Scope**:
  - Integrate `better-sqlite3-multiple-ciphers`
  - Enforce PRAGMA key/rekey and WAL mode
  - Implement DB bootstrap + migration runner
- **Acceptance Criteria**:
  - DB cannot be opened without key
  - Schema migrations apply idempotently
  - WAL mode enabled and validated
- **Deliverable**: Encrypted persistent datastore

### ISSUE-005 — Key Management + Recovery Key Flow
- **Priority**: P0
- **Agent Lane**: B
- **Depends on**: ISSUE-004
- **Scope**:
  - Store encrypted DB key via Electron `safeStorage`
  - First-open key capture workflow
  - Recovery key generation/export/import UX
  - Key rotation/rekey capability
- **Acceptance Criteria**:
  - First open prompts once; subsequent opens auto-unlock
  - Recovery key restores access on a clean machine scenario
  - Rekey operation completes without data loss
- **Deliverable**: Secure and recoverable key lifecycle

### ISSUE-006 — Core Schema + Domain Repositories
- **Priority**: P0
- **Agent Lane**: B
- **Depends on**: ISSUE-004
- **Scope**:
  - Implement foundational tables for vendors/services/contracts/expenses
  - Implement dimensioned tags schema + assignments
  - Add replacement planning entities and scorecards
  - Add audit log and metadata tables
- **Acceptance Criteria**:
  - CRUD repository layer for core entities
  - Referential constraints prevent invalid records
  - Unit tests cover key business invariants
- **Deliverable**: Stable domain model and data access layer

---

## Lane C — Forecasting, Alerts, and Notification Channels

### ISSUE-007 — Forecast Materialization Engine
- **Priority**: P0
- **Agent Lane**: C
- **Depends on**: ISSUE-006
- **Scope**:
  - Generate one-time + recurring occurrences
  - Track staleness state against last mutation
  - Add rebuild triggers and on-demand refresh
- **Acceptance Criteria**:
  - Forecast generation deterministic and repeatable
  - Staleness detection flags outdated projections
- **Deliverable**: Queryable forecast dataset

### ISSUE-008 — Alert Rules Engine + Snooze/Ack/Dedupe
- **Priority**: P1
- **Agent Lane**: C
- **Depends on**: ISSUE-007, ISSUE-002
- **Scope**:
  - Build scheduled evaluator for renewal/notice/EOL/replacement alerts
  - Implement alert event lifecycle (new/ack/snoozed/resolved)
  - Add dedupe and rate-limiting behavior
- **Acceptance Criteria**:
  - Alerts generated for all required trigger families
  - Snooze and acknowledgment suppress duplicate spam
- **Deliverable**: Reliable always-on local alerting

### ISSUE-009 — Teams Webhook Channel
- **Priority**: P1
- **Agent Lane**: C
- **Depends on**: ISSUE-008
- **Scope**:
  - Add Teams Workflows webhook configuration
  - Implement send-test and delivery retry logic
  - Persist channel-level success/failure telemetry
- **Acceptance Criteria**:
  - Test message can be sent from settings page
  - Failed deliveries are surfaced and retried per policy
- **Deliverable**: Optional external alert channel

---

## Lane D — Ingest, Reporting, and Exports

### ISSUE-010 — CSV/XLSX Import Wizard + Validation
- **Priority**: P1
- **Agent Lane**: D
- **Depends on**: ISSUE-006
- **Scope**:
  - Build import flow with column mapping and preview
  - Validate required fields (renewals, recurrence, money)
  - Add dedupe/fingerprinting and bulk correction UX
- **Acceptance Criteria**:
  - User can import files and map columns safely
  - Invalid rows are blocked with actionable messages
- **Deliverable**: Robust ingest foundation

### ISSUE-011 — Tag Automation Rules + Learning Loop
- **Priority**: P1
- **Agent Lane**: D
- **Depends on**: ISSUE-010
- **Scope**:
  - Implement rule engine for automatic dimension/tag assignment
  - Add “promote repeated manual edits to rule” flow
  - Track confidence and rule hit/miss metrics
- **Acceptance Criteria**:
  - Repeated edits can become reusable rules
  - Auto-tagging improves over successive imports
- **Deliverable**: Reduced manual tagging effort

### ISSUE-012 — Reporting Engine + Narrative Templates
- **Priority**: P1
- **Agent Lane**: D
- **Depends on**: ISSUE-006, ISSUE-007
- **Scope**:
  - Implement report query service with dimension filters
  - Add core reports (runway, renewals, department rollups, replacement risk)
  - Add narrative text templates with variable interpolation
- **Acceptance Criteria**:
  - Reports render consistently from live data
  - Narrative reports generated from report datasets
- **Deliverable**: Reporting baseline for decision support

### ISSUE-013 — Multi-format Export Pipeline (HTML/PDF/PNG/Excel/CSV)
- **Priority**: P1
- **Agent Lane**: D
- **Depends on**: ISSUE-012
- **Scope**:
  - HTML package export
  - PDF/PNG exports using Electron webContents APIs
  - Excel/CSV exports via ExcelJS
  - Data leakage controls (report-only vs raw exports)
- **Acceptance Criteria**:
  - All export formats available from report UI
  - Export content matches source report state/time
- **Deliverable**: Production export subsystem

---

## Lane E — Backup, Integrity, and Operations

### ISSUE-014 — Backup/Restore with Manifest + As-Of UX
- **Priority**: P0
- **Agent Lane**: E
- **Depends on**: ISSUE-004, ISSUE-006
- **Scope**:
  - Implement backup using SQLite backup strategy
  - Generate manifest (`backup_started_at`, `backup_finished_at`, `source_last_mutation_at`, `schema_version`, checksum)
  - Build restore flow with “Data current as of …” banner
- **Acceptance Criteria**:
  - Restored app shows manifest as-of timestamp prominently
  - Backup and restore succeed for encrypted DB
- **Deliverable**: Trustworthy backup lifecycle

### ISSUE-015 — Backup Verification + Target Health Monitoring
- **Priority**: P2
- **Agent Lane**: E
- **Depends on**: ISSUE-014, ISSUE-008
- **Scope**:
  - Optional test-restore verification process
  - Monitor backup destination reachability and freshness
  - Raise alerts if backups stale or target unavailable
- **Acceptance Criteria**:
  - Verification can run on schedule/manual trigger
  - Failures appear in alert center and logs
- **Deliverable**: Mature backup reliability controls

### ISSUE-016 — Attachments + Encrypted File Store
- **Priority**: P2
- **Agent Lane**: E
- **Depends on**: ISSUE-005, ISSUE-006, ISSUE-014
- **Scope**:
  - Add attachment metadata and storage path abstraction
  - Encrypt attachment payloads using app key hierarchy
  - Include attachments in backup/restore lifecycle
- **Acceptance Criteria**:
  - Attachments accessible from linked entities
  - Backup/restore preserves attachment integrity
- **Deliverable**: Evidence/document management subsystem

---

## Lane F — UX, Governance, and Quality Controls

### ISSUE-017 — Budget Lifecycle Controls (Snapshots/Scenarios/Approvals)
- **Priority**: P2
- **Agent Lane**: F
- **Depends on**: ISSUE-006, ISSUE-007
- **Scope**:
  - Add period snapshots/locks
  - Implement scenario states (baseline/cost-cut/growth)
  - Add draft/reviewed/approved markers
- **Acceptance Criteria**:
  - Locked periods cannot be accidentally modified
  - Scenario comparisons supported in reporting filters
- **Deliverable**: Governance-ready planning workflow

### ISSUE-018 — Actuals Ingestion + Variance Reporting
- **Priority**: P2
- **Agent Lane**: F
- **Depends on**: ISSUE-010, ISSUE-012
- **Scope**:
  - Ingest actual spend datasets
  - Map actuals to forecast entities
  - Produce variance report views and summaries
- **Acceptance Criteria**:
  - Variance metrics available by service/vendor/department
  - Mismatches can be corrected via mapping tools
- **Deliverable**: Forecast vs actual visibility

### ISSUE-019 — Data Integrity Rules + Audit Experience
- **Priority**: P1
- **Agent Lane**: F
- **Depends on**: ISSUE-006
- **Scope**:
  - Enforce validation rules for recurring/renewal/notice data
  - Add integrity-check commands (including restore-time checks)
  - Build audit timeline view for key field changes
- **Acceptance Criteria**:
  - Invalid state transitions blocked with clear messaging
  - Integrity checks produce actionable diagnostics
- **Deliverable**: Data trust and traceability

### ISSUE-020 — End-to-End Quality Gate + Release Readiness
- **Priority**: P1
- **Agent Lane**: F
- **Depends on**: ISSUE-003 through ISSUE-019 (as applicable)
- **Scope**:
  - Build integration tests for ingest → forecast → alert → reporting → export
  - Add performance budget checks for tray scheduler resource usage
  - Add release checklist (including signing/SmartScreen guidance)
- **Acceptance Criteria**:
  - Test suite validates critical user journeys
  - Release checklist completed before each installer cut
- **Deliverable**: Repeatable, quality-controlled release process

---

## Parallelization Plan (Multi-Agent Execution)

## Phase 1 (Foundation, parallel)
- **Agent A**: ISSUE-001
- **Agent B**: ISSUE-004
- **Agent E**: design prep for ISSUE-014 (manifests/contracts), blocked on ISSUE-004

## Phase 2 (Core platform/data, parallel)
- **Agent A**: ISSUE-002
- **Agent B**: ISSUE-005 + ISSUE-006
- **Agent C**: design spikes for ISSUE-007/008
- **Agent D**: design spikes for ISSUE-010/012

## Phase 3 (Feature build-out, parallel)
- **Agent C**: ISSUE-007 + ISSUE-008 + ISSUE-009
- **Agent D**: ISSUE-010 + ISSUE-011 + ISSUE-012 + ISSUE-013
- **Agent E**: ISSUE-014
- **Agent F**: ISSUE-019

## Phase 4 (Expansion + hardening, parallel)
- **Agent E**: ISSUE-015 + ISSUE-016
- **Agent F**: ISSUE-017 + ISSUE-018 + ISSUE-020
- **Agent A**: ISSUE-003

## Coordination Cadence
- Shared contracts frozen at end of each phase:
  - DB schema contract
  - Event/alert payload schemas
  - Report dataset schemas
  - Backup manifest schema
- Weekly integration branch merge with smoke-test matrix.
