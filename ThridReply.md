Got it — your answers tighten the design a lot. With **single-user / one device / Windows-only / USD-only**, we can make this *much* more reliable and “installer-friendly” while still keeping the “web app” feel (UI in the browser engine) and staying **100% TypeScript**.

Below is the updated architecture + decisions + gaps you *weren’t* thinking about (including one important encryption/backup gotcha).

---

## Updated “best-fit” platform choice

### Recommendation: **Electron desktop app (TypeScript)**

* You still build the UI like a web app (React/Vite/etc.), but it ships as a single Windows installer and includes its own runtime (Chromium + Node), which keeps the dependency story simple.
* It also gives you:

  * Background tray mode (optional)
  * Desktop notifications
  * Reliable scheduled alerting
  * PDF/PNG exports using the same renderer engine

**Key APIs you’ll use for exports:**

* `webContents.printToPDF()` for PDFs ([Electron][1])
* `webContents.capturePage()` for PNG screenshots ([Electron][1])

---

## Database choice: encrypted SQLite is still right, with one nuance

### SQLite remains a great fit here

* Single-user, single-device, local-first → SQLite is ideal.
* Biggest benefit: you can do **fast local analytics/reporting** without standing up a server DB.

### Encryption approach (practical in TS/Node)

Use an encrypted SQLite build via **better-sqlite3-multiple-ciphers**:

* It supports encrypt/decrypt via `PRAGMA key` / `PRAGMA rekey` patterns ([GitHub][2])
* It can optionally interop with “legacy SQLCipher mode” (handy for advanced troubleshooting) ([GitHub][2])
* Drizzle ORM can sit on top via the **better-sqlite3** driver path (type-safe schema + migrations) ([orm.drizzle.team][3])

---

## Key storage: your requirement is doable — but there’s a disaster-recovery gap

You said: “Store the key in OS secure storage; only required first time DB is opened.”

On Windows, Electron’s `safeStorage` uses **DPAPI** ([Electron][4])
That’s perfect for your “don’t ask me every time” requirement.

### The gap you likely weren’t thinking about

**DPAPI-protected secrets generally can’t be decrypted on a different machine/user** (it’s tied to the Windows user/machine context). ([Microsoft Learn][5])

So: if the PC dies and you restore the encrypted DB backup on a new PC, you could be locked out unless you also have a recovery method.

### Fix: add one of these (I recommend doing both)

1. **Recovery Key export (recommended)**

   * First run: generate a 32-byte DB key.
   * Store it in `safeStorage` for convenience.
   * Also show the user a one-time **Recovery Key** (base64) and strongly suggest saving it to the same external drive/network share as backups.
2. **Optional user passphrase** (entered once, then stored)

   * Convenience is same as above
   * But passphrase can be re-entered manually on a new machine if needed (if you don’t store it, just store a verifier)

This gives you convenience *and* survivable backups.

---

## Tags vs “structured fields” (your #6) — what’s better?

You’re right to like tags. The trick is: **use tags for categorization**, but keep a few **hard-typed fields** for things that must be correct for math/alerts.

### Keep these as structured fields (not tags)

* Amount (cents integer), start date, end date, recurrence
* Renewal date
* Notice/cancellation window days (because alerts depend on it)
* Status/state (planned/approved/committed/paid/cancelled)
* Scenario/baseline versioning (optional but recommended)

### Use tags for everything else (but do it as “dimensions”)

Instead of freeform tags only, use **dimensions** like:

* Cost Type: OpEx / CapEx (single select)
* Department (single select)
* Cost Center (single select)
* Environment: Prod / Dev / Shared (single select)
* Category: Security / IT Ops / SaaS / Cloud / Hardware (multi OK)
* Criticality, Risk, Compliance scope, etc.

This keeps reporting clean (no “OpEx + CapEx both applied” mistakes).

---

## Replacement planning (your #10): tags alone are a trap

You asked if replacement workflow can be tags. You *can*, but it gets messy fast because replacements need:

* deadlines (“must replace by”)
* workflow state (“evaluating → approved → migrating → complete”)
* candidate comparisons (scorecards, cost estimates)
* links between “old tool” and “replacement tool”

### Recommendation

Use **structured replacement planning** *plus* tags.

Core entities:

* `service_plan`:

  * planned_action: keep / drop / replace / evaluate
  * reason: EOL / too expensive / poor fit / security / consolidation
  * must_replace_by date
  * replacement_required boolean
  * replacement_selected_service_id nullable
* `replacement_candidate`
* `scorecard` (your #11 “yes do it”)

Tags still help (category, department, risk), but the workflow needs structure.

---

## Alerting & renewals (your #7, #8, #9)

### Desktop notifications (app running)

Easy if:

* app is open, or
* app runs in tray background

### “Soft reminders with sleep”

Implement:

* alert events with states: pending → fired → acknowledged
* snooze options: 1 day / 7 days / custom date
* dedupe keys (don’t spam)

### Cancellation/notice windows (you want this)

You’ll model:

* `renewal_date`
* `notice_period_days`
* computed `cancellation_deadline = renewal_date - notice_period_days`

Alert rules:

* “Renewal in 90/60/30 days”
* “Cancellation deadline in 30/14/7 days”
* “Renewal coming but no replacement selected”

---

## Teams webhook support: important update for 2026

You said: “Teams webhooks would be helpful if always running in the background.”

Heads up: **Office 365 Connectors / incoming webhook connectors are being retired in Teams** and Microsoft’s migration path is **Workflows (Power Automate) webhooks**. Microsoft’s dev blog update (Feb 5, 2026) mentions:

* MessageCard support is available in Workflows (with limitations)
* Shared channel posting enabled; private channel support still in progress
* Deprecation deadline extended to **April 30, 2026** ([Microsoft for Developers][6])

### Design implication

Implement a “Teams Notifications” integration that targets:

* **Workflows webhook URLs**
* Support both:

  * MessageCard-like payloads for compatibility (non-interactive)
  * Adaptive Card payloads for richer messages (recommended long-term)

And make this optional (user pastes webhook URL, can test).

---

## Backups: reliable + “as-of” timestamp + restore clarity (your key requirement)

### What you asked for

* Backup location user-chosen: local disk / network share / external drive ✅
* Backup contains “how current is this” info ✅
* After restore, user can see “data is current as of …” ✅

### SQLite-approved strategies

SQLite supports hot backup techniques; the official docs call out:

* Online Backup API ([sqlite.org][7])
* `VACUUM INTO` as an alternative for creating backup copies ([sqlite.org][8])

### Implementation plan (simple + robust)

* Maintain `meta.last_mutation_at` (updated on every write transaction)
* Backup writes two files:

  1. `budget_backup_YYYYMMDD_HHMMSS.db`
  2. `budget_backup_YYYYMMDD_HHMMSS.manifest.json` (contains last_mutation_at, schema version, checksum)

On restore:

* Validate schema version
* Optional: run integrity check
* Display prominently:

  * “Backup captured as-of: 2026‑02‑26 18:41”
  * “Restored at: …”
  * “Backup file checksum verified: yes/no”

### Encryption nuance

Because we’re using an encryption-enabled SQLite build, we should validate early that our chosen backup method preserves encryption and is compatible with the cipher/key settings. SQLite supports multiple backup paths ([sqlite.org][7]), but encryption extensions can impose compatibility constraints depending on how the destination DB is created. This is a “test in week 1” item, not a “find out later” item.

---

## Robust ingest system (your #15): design for “minimum tedious tagging”

This is a big feature, but it can be *very* good if we treat it like a product on its own.

### Core components

1. **Import Wizard**

   * Accept CSV + XLSX
   * Preview rows
   * Column mapping step:

     * vendor name, service name, amount, start/end, renewal, frequency, notes, cost center, department, etc.

2. **Entity Matching**

   * Fuzzy match vendor/service to existing catalog
   * “Create new vendor/service” inline
   * Duplicate detection via row fingerprinting (hash of normalized fields)

3. **Auto-tagging rules engine**
   User-configurable rules like:

   * If `vendor contains "Microsoft"` → tag Category=Productivity, Vendor=Microsoft
   * If `description matches /endpoint|edr/i` → tag Category=Security
   * If `cost_center starts with 42` → tag Cost Center=42xx
   * If `amount > 10000` → tag Spend Tier=High

4. **“Learn from my edits”**
   When you manually tag imported rows:

   * the app suggests “Create a rule from this?”
   * you approve/edit rule once
   * future imports get that tagging automatically

5. **Tagging completeness dashboard**
   Show:

   * % of spend with Department assigned
   * % of recurring spend with renewal date set
   * untagged / unmapped rows

This is how you avoid “death by tagging” while still getting reporting-grade data.

---

## Reporting & exports (your #16): tables, charts, gauges, written reports

### Output formats you requested

* HTML ✅
* PDF ✅ (Electron print) ([Electron][1])
* Excel ✅ (ExcelJS) ([npm][9])
* CSV ✅
* PNG ✅ (Electron capture) ([Electron][1])

### Report types

1. **Tables** (sortable, filterable, exportable)
2. **Charts** (trend, bar, stacked, pie)
3. **Gauges** (budget used, “renewal risk score”, tagging completeness)
4. **Written report**

   * A templated narrative page (Markdown-backed works well)
   * Can embed tables/charts inline
   * Exports to PDF/HTML

### Reporting engine concept (so this stays maintainable)

Define reports as TypeScript objects:

* Dataset query (SQL/Drizzle)
* Visual spec (chart/gauge/table)
* Narrative blocks (optional)
* Export pipeline hooks

---

## NLQ: “natural language querying” without turning into a security risk

Given you’re local-first and want reliable reporting, the best pattern is still:

1. NLQ → **validated FilterSpec JSON**
2. FilterSpec → parameterized SQL queries

This lets you show:

* “Here’s what I think you meant…”
* “Click to adjust”
  …and prevents unsafe or surprising queries.

You can still add an LLM layer later (local model or optional cloud), but it shouldn’t be required for v1.

---

## Installer requirement (Windows-only)

### Recommendation: electron-builder + NSIS

electron-builder’s NSIS target is the standard Windows path ([Electron Builder][10])

You can customize installation logic via:

* `nsis.include` (recommended for small customizations)
* or `nsis.script` (full override) ([Electron Builder][10])

**Dependency checks**
With Electron, most dependencies vanish (you ship your runtime). If you still want a “dependency check” step, it’s typically for things like:

* verifying write access to the chosen data directory
* verifying network share is reachable if selected
* verifying Teams webhook URL looks valid (optional)
* optionally ensuring a VC++ runtime exists if your native modules require it (this is testable during packaging)

---

## Extra “gap analysis” items worth adding now (high ROI)

1. **Encryption key recovery** (the DPAPI portability issue)
2. **“Snapshot/lock budget”** for a fiscal year (so history can’t be accidentally rewritten)
3. **Attachments** (contracts/quotes)

   * store encrypted files alongside the DB with references
4. **Data validation rules**

   * “Recurring expense must have renewal date”
   * “Contract with auto-renew must have notice period”
5. **Staleness detection**

   * “Forecast not regenerated since last mutation”
   * “Backup older than X days”

---

## One last (small) question — and I’ll proceed either way

Do you want the app to support **tray mode + “start with Windows”** by default?

* If **yes**, you’ll get reliable reminders even when the window is closed, and Teams notifications become practical.
* If **no**, reminders are best-effort (only while the app is open), which you said is acceptable — but renewals can be missed if the app isn’t opened regularly.

I can proceed with either as the default (I’d default to **optional tray mode**, user-enabled).

---

## What I’ll build next in the design (pick one and I’ll go straight into it)

1. A **final schema** (Drizzle tables + migrations) tailored to your decisions (USD-only, Windows-only, replacement workflow, tagging dimensions).
2. The **import system spec** (file formats, mapping UX, rule engine, dedupe strategy).
3. The **report/export pipeline spec** (how each format is generated, and how reports are defined in TS).
4. The **alert rules catalog** (renewals, notice windows, thresholds, snooze model, Teams payloads aligned to Workflows).

Tell me which one you want first and I’ll write it out in detail.

[1]: https://www.electronjs.org/docs/latest/api/web-contents "webContents | Electron"
[2]: https://github.com/m4heshd/better-sqlite3-multiple-ciphers?utm_source=chatgpt.com "GitHub - m4heshd/better-sqlite3-multiple-ciphers: better-sqlite3 with ..."
[3]: https://orm.drizzle.team/docs/get-started-sqlite?utm_source=chatgpt.com "Drizzle ORM - SQLite"
[4]: https://www.electronjs.org/docs/latest/api/safe-storage?utm_source=chatgpt.com "safeStorage - Electron"
[5]: https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata?utm_source=chatgpt.com "CryptProtectData function (dpapi.h) - Win32 apps | Microsoft Learn"
[6]: https://devblogs.microsoft.com/microsoft365dev/retirement-of-office-365-connectors-within-microsoft-teams/ "Retirement of Office 365 connectors within Microsoft Teams"
[7]: https://sqlite.org/backup.html?utm_source=chatgpt.com "SQLite Backup API"
[8]: https://sqlite.org/lang_vacuum.html?utm_source=chatgpt.com "VACUUM - SQLite"
[9]: https://www.npmjs.com/package/exceljs?utm_source=chatgpt.com "ExcelJS - npm"
[10]: https://www.electron.build/nsis.html?utm_source=chatgpt.com "NSIS - electron-builder"
