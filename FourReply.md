## Internal IT Budgeting App (Windows-only) — Updated plan you can log

### 1) What we’re building

A **self-contained, locally hosted budgeting + reporting app** for internal IT that runs on **one Windows machine for one user**, supports **one-time + recurring expenses** (existing + future), includes **reporting + NLQ**, and has a **robust alerting + renewal + cancellation-notice system**, plus **replacement planning** (EOL, too expensive, poor fit) and **strong backup/restore with “as-of” timestamps**.

---

## 2) Locked constraints & decisions

* **User model:** single user
* **Device model:** one device (no multi-user / no LAN access)
* **OS:** **Windows only**
* **Currency:** **USD only**
* **Fiscal year:** not strictly required, but **include configurable fiscal year** (recommended and now in scope)
* **Encryption key UX:** only prompt the first time a DB is opened; otherwise **store key in OS secure storage**
* **App runtime:** **runs in background (tray) + starts with Windows by default**
* **Notifications:** soft reminders + **snooze**
* **Teams notifications:** desirable because the app will be running in background
* **Data ingest:** “very robust” + avoid tedious manual tagging via automation/rules
* **Exports:** reports exportable to **HTML, PDF, Excel, CSV, PNG**, plus written narrative reports

---

## 3) Delivery architecture (what “web app” means here)

### Chosen delivery: **Electron desktop app (TypeScript)**

* UI is still built like a web app (React/Vite/etc.), but shipped as a Windows installer.
* Electron gives you:

  * **system tray presence** (app can stay running when windows are closed) via the `Tray` API. ([Electron][1])
  * **start with Windows** using `app.setLoginItemSettings({ openAtLogin: true })`. ([Electron][2])
  * reliable background scheduling for alerts (because the app is actually running)

---

## 4) Data storage & encryption plan

### Database

* **Encrypted SQLite** remains the best fit: simple, local-first, high performance for reporting, easy single-file backup/restore.

### Encryption library approach (TS-friendly)

* Use **`better-sqlite3-multiple-ciphers`** as the SQLite binding + encryption mechanism.

  * Supports encryption/decryption via `PRAGMA key` and `PRAGMA rekey`. ([GitHub][3])
  * Encourages WAL for performance (`journal_mode = WAL`). ([GitHub][3])

### Key storage (Windows)

* Use Electron **`safeStorage`** for storing the DB key encrypted using OS crypto (Windows uses **DPAPI**). ([Electron][4])
* Important security semantics to log:

  * DPAPI generally means only the same Windows logon can decrypt. ([Electron][4])
  * It protects against other users, but not necessarily other apps running as the same user. ([Electron][4])

### **Extra gap analysis item added (critical): recovery key**

Because DPAPI is tied to the machine/user context, backups restored onto a different Windows install may not be decryptable without an additional recovery path. So we add:

* **Recovery key export** (one-time display + “export to file” option)

  * The DB still auto-unlocks on the normal machine via safeStorage
  * But the user can recover after a PC loss / migration by providing the recovery key

This is now explicitly in-scope.

---

## 5) Backup & restore plan (with “how current is this?”)

### Backup mechanics

Use SQLite-supported backup approaches:

* SQLite provides an **Online Backup API** and notes other techniques like **`VACUUM INTO`** to create a copy of a live database. ([SQLite][5])

### Backup artifacts (mandatory)

Each backup produces:

1. `backup_YYYYMMDD_HHMMSS.db` (encrypted DB snapshot)
2. `backup_YYYYMMDD_HHMMSS.manifest.json` containing:

   * `backup_started_at`, `backup_finished_at`
   * `source_last_mutation_at` (**the “as-of” timestamp**)
   * `schema_version`
   * `db_checksum` (sha256)

### Restore UX requirement (mandatory)

After restore, the app must prominently display:

* **“Data current as of: source_last_mutation_at”**
* “Restored at: …”
* Optional: DB integrity verification and status in the UI

### Backup destinations (user-controlled)

* local disk
* network share
* external drive
  (plus: health checks and retry behavior for unreliable network paths)

---

## 6) Always-running alerting model (updated for tray + startup)

Because the app now **starts with Windows and stays alive in the tray by default**, alerting is not “only when the app window is open” — it’s effectively “always” while the user session is active.

### Alert types in scope

* Upcoming expense occurrences (recurring invoices)
* Renewal windows (30/60/90)
* **Cancellation notice deadlines** (renewal minus notice period)
* “Renewing soon but not yet reviewed”
* “Marked for replacement but no replacement selected”
* “EOL date approaching”

### Alert behavior

* **Soft reminders**
* **Snooze** (sleep function) + acknowledge + dedupe so you don’t get spammed

### Notification channels

* In-app alert center + tray badge concept
* Desktop notifications (Windows)
* **Teams webhook** (optional, configured by user)

---

## 7) Teams webhook integration plan (updated for 2026 reality)

Microsoft’s guidance has shifted from classic Office 365 Connectors toward Workflows-based webhooks, and Microsoft’s own developer blog states the deadline is extended to **April 30, 2026**, and that Message Card support is now available in Workflows (with limitations such as no button rendering). ([Microsoft for Developers][6])

So the integration plan is:

* Support **Teams Workflows incoming webhook URLs** (user pastes URL + “Send test”)
* Payload strategy:

  * “MessageCard-like” simple payloads where supported
  * Prefer modern card/message formats as Microsoft guidance evolves
* Configuration should live in “Alerting → Channels → Teams”

Also log: Microsoft Support documentation describes “incoming webhooks with Workflows for Microsoft Teams.” ([Microsoft Support][7])

---

## 8) Tagging + reporting (what’s tags vs what’s structured)

### Decision: use **dimensioned tags** + a few required structured fields

* You prefer tags (agree), but we **do not** model critical math/alerting fields as tags.

**Structured fields (must be typed):**

* money amount (cents), dates, recurrence, renewal date, notice period, scenario/state

**Tags (dimensioned) for reporting:**

* department, cost center, environment, category, criticality, risk, compliance scope, etc.

This keeps reporting powerful without allowing mathematically-invalid states.

---

## 9) Replacement planning (not “just tags”)

You asked if replacement workflow could be tags. Final decision:

* **Replacement planning is structured data**, because it needs:

  * deadlines (must replace by)
  * workflow states
  * candidate comparisons
  * “selected replacement” linkage
* Tags can still annotate replacement items, but tags alone become brittle for this workflow.

### Scorecards (added per your request)

Replacement records include a scorecard concept (structured):

* cost, satisfaction, security posture, reliability, admin overhead, vendor risk
* used for justification in written reports

---

## 10) Robust ingest system (minimal manual tagging)

This is in scope and treated as a first-class feature area.

### Ingest goals

* Bring in data from CSV/XLSX
* Match vendors/services automatically where possible
* Apply tags automatically via rules
* “Learn from my edits” (turn repeated manual tagging into rules/templates)

### Ingest UX building blocks

* import wizard with column mapping
* preview + validation (catch missing renewal dates, invalid currency, etc.)
* dedupe + row fingerprinting
* tag suggestion + bulk apply
* rules engine (if vendor/description/account → tags/dimensions)

---

## 11) Reporting + export formats

Reports can be:

* tables
* charts
* gauges
* written narrative reports (templated)

### Exports (all in scope)

* **PDF**: Electron `webContents.printToPDF()` returns a PDF buffer. ([Electron][8])
* **PNG**: Electron `webContents.capturePage()` returns an image capture. ([Electron][8])
* **Excel + CSV**: use **ExcelJS** (read/write xlsx and csv). ([npm][9])
* HTML export: save rendered report package (HTML + assets)
* CSV export: for table datasets (separate from “report export”)

---

## 12) Installer & deployment (Windows)

### Installer

* Use **electron-builder** with **NSIS** as the Windows installer target.
* NSIS customization approach:

  * Prefer `include` for small customizations
  * Use `script` only when replacing the full NSIS script is required. ([Electron Build][10])

### Startup/tray defaults

* Installer or first-run will enable:

  * “Start with Windows” (via Electron login item settings) ([Electron][2])
  * “Minimize to tray on close” (tray remains running) ([Electron][1])
* Settings must allow disabling both.

---

# Added gap analysis (now explicitly in scope)

Below are the “you will regret it later if you skip it” items, now added to the plan:

## A) Security & recoverability

* **Recovery key export** to prevent lockout after machine loss (DPAPI portability issue). ([Electron][4])
* **Key rotation / rekey** workflow (rare but necessary if compromise suspected)
* **Secure export controls**

  * exporting a report should not accidentally export raw sensitive data unless selected
* **Audit log**

  * who/what changed, especially renewal dates and amounts (even single-user benefits)

## B) Data integrity & trust

* **Data validation rules** (hard errors/warnings):

  * recurring expense must have recurrence + start date
  * renewable contract must have renewal date
  * auto-renew should have notice period
* **Staleness detection**

  * detect when forecast materialization/report cache is out-of-date relative to last DB mutation
* **DB integrity check option**

  * on restore and optionally on schedule

## C) Budget lifecycle management

* **Snapshot / lock a budget period**

  * “freeze FY2026 baseline” so you can’t accidentally rewrite history
* **Scenario support**

  * baseline vs cost-cut vs growth
* **Approval markers**

  * “draft / reviewed / approved” states for scenarios or key reports

## D) Actuals vs forecast

* Support a pathway for **actual spend ingestion** (CSV/XLSX) so you can do variance reporting.
* Even if you don’t integrate directly with accounting systems, structure should allow “actuals” to exist.

## E) Attachments & evidence

* Support attaching:

  * contracts, order forms, invoices, quotes
* Decide storage strategy:

  * encrypted file store alongside DB with references (preferred)
  * plus backup/restore includes attachments

## F) Backup maturity

* **Backup verification**

  * optional “test restore” into a temporary DB + integrity check
* **Backup monitoring**

  * alert if backups are older than X days
  * alert if backup target is unreachable (network share/offline drive)

## G) Windows operational considerations

* **Tray-first UX**

  * closing window does not stop alerts
  * a clear “Exit” action is required
* **Resource usage guardrails**

  * background scheduler should remain low CPU/memory
* Optional but recommended: code signing / SmartScreen considerations (to reduce install friction)

## H) Teams integration robustness

* Treat Teams as an optional channel, and align it to **Workflows webhooks** with the published retirement timeline (Apr 30, 2026) to avoid building on a deprecated connector model. ([Microsoft for Developers][6])

---

If you copy/paste the above into your project notes, it’s a faithful “current plan” snapshot incorporating:

* your answered constraints,
* the tray + auto-start default,
* and the expanded gap analysis items you explicitly wanted included.

[1]: https://www.electronjs.org/docs/latest/api/tray?utm_source=chatgpt.com "Tray - Electron"
[2]: https://www.electronjs.org/docs/latest/api/app "app | Electron"
[3]: https://github.com/m4heshd/better-sqlite3-multiple-ciphers "GitHub - m4heshd/better-sqlite3-multiple-ciphers: better-sqlite3 with multiple-cipher encryption support "
[4]: https://www.electronjs.org/docs/latest/api/safe-storage "safeStorage | Electron"
[5]: https://sqlite.org/backup.html "SQLite Backup API"
[6]: https://devblogs.microsoft.com/microsoft365dev/retirement-of-office-365-connectors-within-microsoft-teams/ "Retirement of Office 365 connectors within Microsoft Teams"
[7]: https://support.microsoft.com/en-us/office/create-incoming-webhooks-with-workflows-for-microsoft-teams-8ae491c7-0394-4861-ba59-055e33f75498?utm_source=chatgpt.com "Create incoming webhooks with Workflows for Microsoft Teams"
[8]: https://www.electronjs.org/docs/latest/api/web-contents "webContents | Electron"
[9]: https://www.npmjs.com/package/exceljs?utm_source=chatgpt.com "exceljs - npm"
[10]: https://www.electron.build/nsis.html "NSIS - electron-builder"
