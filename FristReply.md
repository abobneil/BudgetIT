Below is a concrete blueprint for a **locally hosted, self‑contained IT budgeting app** with **recurring + one‑time expenses**, **robust tagging + reporting**, **NLQ**, **alerts/renewals**, **replacement planning**, **encrypted local storage**, **backups with “as‑of” timestamps**, and a **cross‑platform installer** — while keeping the app’s **business logic in TypeScript**.

---

## Recommended “local-first” architecture

### The key decision: “web app” delivery model

You’ve got two realistic ways to deliver a “web app” experience while still being self‑contained:

1. **Desktop app shell + embedded web UI (recommended)**

* UI is still a web app (React/Vue/etc), but runs inside a packaged desktop shell.
* You can run background jobs (alerts) reliably, even when no browser tab is open.
* You can bundle everything so the installer has **near‑zero external dependencies**.

**Best fit if you want: reliable alerting, simplest install, offline-first.**

2. **Local server + user opens browser**

* Install a local service that hosts `http://localhost:XXXX`.
* Alerts require the service to run continuously (OS service/daemon).
* Installer must manage service install/start/auto-start.

**Best fit if you want: “real browser” UI and maybe multi-device access later (still local network).**

Given your alerting + replacement workflow requirements, I’d strongly lean to **(1)** unless “must be in a normal browser” is a hard requirement.

---

## TypeScript-only vs “tiny native layer”

You said “the whole app should be in TypeScript.” That’s easiest with Electron, because the runtime is JS/Node end-to-end.

### Option A (cleanest for “all TypeScript”): Electron

* Electron is actively released; stable releases are published continuously (for example, Electron’s stable channel shows recent releases in Feb 2026). ([Electron][1])
* Packaging: **electron-builder** creates Windows NSIS installers, macOS DMGs, Linux packages, and includes auto-update support. ([npm][2])
* You can run background tasks and native notifications easily.

### Option B (smaller footprint + built-in WebView dependency handling): Tauri v2

* Tauri’s Windows installer can **check/install WebView2** via configurable install modes (download bootstrapper, embedded bootstrapper, offline installer, fixed runtime). ([Tauri][3])
* Tradeoff: Tauri includes a Rust core. Your business logic can still be TS, but it’s not *literally* 100% TS.

If “100% TS” is strict, use Electron. If you can tolerate a minimal Rust shell, Tauri gives a very polished dependency story on Windows.

---

## Data storage: is encrypted SQLite the right choice?

### SQLite is a good default for local-first

* Single file, fast, robust, easy backup/restore.
* Great for offline-first budgeting apps.
* You can still support multiple “budget files” (one DB per org/team) later.

### But: SQLite doesn’t encrypt by default

SQLite itself does **not** support file encryption out-of-the-box; you need a modified build or encryption extension (SQLCipher, wxSQLite3, etc.). ([Microsoft Learn][4])

So your “encrypted SQLite” instinct is right — you just need to pick the encryption approach carefully.

---

## Encryption options that work well with a TS app

### Option 1: SQLCipher (classic choice)

* SQLCipher is a fork of SQLite that adds strong encryption (AES-256) and related security features. ([GitHub][5])
* It supports export/backup patterns like `sqlcipher_export()` and can work with SQLite backup mechanisms. ([DeepWiki][6])
* SQLCipher is actively released (e.g., SQLCipher 4.13.0 release notes in Jan 2026 mention updating the upstream SQLite baseline). ([Zetetic][7])

**Risk to watch:** many Node bindings for SQLCipher are old or lag behind current SQLCipher/SQLite. For example, `@journeyapps/sqlcipher` bundles SQLCipher 4.4.2 (SQLite 3.33.0) and its last tagged release is from 2022. ([GitHub][8])
That doesn’t automatically make it “bad,” but it’s a maintenance/security tradeoff.

### Option 2: SQLite3 Multiple Ciphers via `better-sqlite3-multiple-ciphers` (very practical in 2026)

There’s an actively maintained fork of `better-sqlite3` that supports encryption using **SQLite3MultipleCiphers**, including compatibility modes for SQLCipher databases:

* It’s positioned as “better-sqlite3 with multiple-cipher encryption support.” ([GitHub][9])
* Its README lists current versions (example: SQLite 3.51.2 + SQLite3 Multiple Ciphers 2.2.7) and shows encryption via `PRAGMA key` / `PRAGMA rekey`. ([GitHub][9])
* It explicitly recommends WAL mode for performance. ([GitHub][9])

This is often the sweet spot for a TS app because:

* You get the speed/dev UX of `better-sqlite3`,
* plus encryption support that’s not stuck on an old SQLCipher bundle.

**If you want “encrypted SQLite” + “TypeScript everywhere” + “least pain,” this is currently my top pick.**

---

## Key management: the part that actually decides “security”

Encryption at rest is only as strong as how you handle the key.

### Recommended approach for a desktop app

* Require a user passphrase on first run (or generate a random key).
* Store the derived key **using OS-provided secure storage**.

**Electron option:** use `safeStorage` to encrypt small secrets for storage on disk using OS cryptography systems. ([Electron][10])
(You can store the DB encryption key encrypted by safeStorage.)

**Alternative:** `keytar` stores secrets in the system keychain (Keychain / Credential Vault / libsecret). ([GitHub][11])
This is reliable, but adds a native module dependency.

**Threat model reality check:**
If an attacker has the same OS user access while the user is logged in, they can typically access whatever the app can access. Encryption at rest mainly protects against **offline theft of the DB file** and backups.

---

## Core domain model (what you should store)

You’ll want to separate **assets/services** from **expenses**, because a “thing we pay for” often has multiple lines (licenses + support + add-ons, etc.) and can change over time.

### Core entities

1. **Vendor**

* name, domain, contacts, support URL, renewal terms

2. **Service / Solution (the “thing” you own)**

* name, vendor_id, owner (person/team)
* lifecycle: `active | trial | deprecated | retiring | retired`
* reason codes: `EOL | too_expensive | poor_fit | security | consolidation | other`
* optional: EOL date, internal “end of support” date, “must replace by” date

3. **Contract / Subscription**

* service_id, contract_id, start/end dates, renewal type (auto/manual), notice period, billing terms
* attachments: order forms, invoices, SoWs

4. **Expense line item**
   A single *cost driver*:

* `type`: `one_time | recurring`
* `amount`, `currency`, `tax`, `payment_method`, `gl_code` (optional)
* recurrence: monthly/annual/quarterly + anchor dates
* allocation rules: cost center, department, environment, location, etc.
* status: `planned | approved | committed | actual | cancelled`
* links to: contract_id and service_id

5. **Budget & Scenario**

* budgets live in “scenarios” (baseline, optimistic, cost-cut, etc.)
* scenario cloning is huge for IT budgeting (“what if we drop tool X?”)

6. **Replacement plan**

* service_id, “decision date”, “replacement needed” flag
* candidate replacements (linked to other services) + notes
* migration effort estimate (t-shirt sizing) + risks

---

## Tagging system design that stays powerful (and report-friendly)

A common pitfall is implementing “tags” as just free-form labels and then realizing you also need structured dimensions like cost center and environment.

### Use “Dimensions + Tags”

* A **Tag** has: `id, name, dimension_id, parent_id?, archived_at?`
* A **Dimension** defines rules:

  * `single_select` (exactly one) vs `multi_select`
  * `required` vs optional
  * examples: `Vendor`, `Cost Center`, `Department`, `Environment`, `Criticality`, `Compliance`, `Funding Source`, `Project`, `Initiative`

This gives you:

* clean reporting pivots,
* guardrails (no expense tagged with 3 cost centers),
* and the freedom of ad-hoc tags where you want them.

---

## Reporting engine: make it “SQL-first” and user-friendly

### Minimum “must-have” reports

* Forecast spend by month (next 12/18/24 months)
* Renewals due in 30/60/90 days
* Vendor spend (month + annual)
* “Top growing costs” (YoY or scenario vs baseline)
* “Cost-to-replace” planning board
* Actuals vs Budget (variance)

### Data strategy

* Store **normalized facts** (expenses, schedules, tags)
* Generate **materialized monthly projections** (a table like `expense_occurrences`) so reports are fast and stable, rather than recomputing every chart on the fly.

This also makes alerting easy (alerts subscribe to “occurrences” and “renewals”).

---

## NLQ: how to do it locally without making a mess

You can do “Natural Language Querying” in layers:

### Layer 1 (deterministic “NL-ish” query language)

Implement a simple parser that supports:

* “next quarter”, “last fiscal year”, “> $10k”, “renewals in 45 days”
* tag references: “vendor Okta”, “env prod”, “cost center 4102”
* outputs a structured filter → SQL query

This is 100% offline and predictable.

### Layer 2 (optional AI NLQ)

If you want true NLQ like “show tools we should replace next year because they cost too much,” you typically need an LLM.

To keep it self-contained:

* Offer **local model integration as optional** (user downloads a model), or
* Allow bringing-your-own model server (e.g., user runs something like Ollama), while the app remains offline by default.

Either way, the LLM should output a **validated JSON filter spec**, not raw SQL (to avoid injection and hallucinated fields).

---

## Alerting system that actually works when people need it

### What to alert on

* Upcoming payment occurrence (e.g., annual invoice due)
* Renewal date approaching (30/60/90 day windows)
* Contract notice window about to close
* Service is “retiring” but has no replacement selected
* EOL date reached / approaching
* Budget threshold breaches (monthly/annual caps)

### How to implement locally

* Maintain an **Alert Rules** table (per user/org settings)
* Have a background “job runner” that:

  * computes upcoming occurrences,
  * creates alert instances,
  * dedupes notifications,
  * writes a notification log.

### Delivery channels

* In-app notifications + badge count
* Desktop notifications
* Optional: email (SMTP) / Slack / Teams webhooks

If you do a desktop shell, you can run this scheduler reliably. If you do browser-only, you’ll need an installed service/daemon.

---

## Backup & restore that proves “how current” it is

### Requirements you listed (and how to satisfy them)

1. **Consistent backups**
   SQLite’s official guidance includes using the Online Backup API and also notes that `VACUUM INTO` can create a vacuumed copy of a live DB. ([SQLite][12])
   For encrypted DBs:

* SQLCipher supports export patterns like `sqlcipher_export()` and notes `VACUUM INTO` as a copy approach too. ([DeepWiki][6])

2. **Backup should remain encrypted**

* If the DB is encrypted, backup outputs should be encrypted as well.
* Never dump plaintext SQL as your primary backup format.

3. **Backup should include “as-of” timestamp**
   Do this in two places:

* In the DB itself: `meta.last_mutation_at`
* In the backup artifact: a `manifest.json` that contains:

  * `backup_started_at`
  * `backup_finished_at`
  * `source_last_mutation_at`
  * `schema_version`
  * optional: `db_file_hash`

On restore, the app reads the restored DB’s `meta.last_mutation_at` and surfaces it prominently:

* “Restored backup is current as of: Feb 12, 2026 14:03:22”

### How to track `last_mutation_at`

Simplest, reliable approach:

* A single-row `meta` table
* Update it **in application code** on every write transaction, *and optionally* enforce via triggers for defense-in-depth.

---

## Database tooling in TypeScript

For schema + migrations + type-safe queries:

* **Drizzle ORM** has SQLite support and explicitly supports `better-sqlite3` as a driver. ([orm.drizzle.team][13])

Even if you don’t use a full ORM, still use a migrations tool — budgeting apps evolve quickly, and schema drift kills trust.

---

## Installer & dependency management

### Electron path (TS-only)

* Package with **electron-builder**; it produces Windows installers (NSIS is the default Windows target) and supports auto update. ([npm][2])
* Dependency checks:

  * Electron itself bundles Chromium + Node, so you avoid a lot of system deps.
  * If you use native modules (SQLite bindings, keytar), you’ll ship prebuilt binaries and ensure your build pipeline produces them for each target OS/arch.

### Tauri path (best built-in dependency check on Windows)

* Tauri’s Windows installer can be configured to handle WebView2 installation via `webviewInstallMode` (download bootstrapper / embed / offline installer / fixed runtime). ([Tauri][3])

### “Single binary” local server option (advanced)

Node’s **Single Executable Applications (SEA)** lets you distribute a Node app without Node installed. ([Node.js][14])
However, SEA gets trickier with **native addons** (like SQLite encryption bindings), so it’s often more effort than it sounds for an encrypted SQLite app.

---

## Gap analysis: important things you didn’t explicitly ask for (but you’ll want)

### Product / workflow gaps

* **Scenario planning** (baseline vs cost-cut vs growth)
* **Approval workflow** (draft → reviewed → approved) for budget signoff
* **Actuals import** (CSV import from finance, or manual “actual” entry)
* **Cost allocation rules** (split 60/40 across cost centers; per-seat allocation)
* **Fiscal calendar support** (not everyone is Jan–Dec)
* **Multi-currency** (if you have global vendors)
* **Contract notice periods** (90-day cancellation windows are common)
* **Attachments** (contracts/invoices/quotes) with secure storage
* **Change history / audit log** (“who changed the renewal date?”)
* **Soft delete + archive** (budget history matters)

### Security / operational gaps

* **Key rotation / rekey** plan (especially if someone leaves)
* **Least-privilege file permissions** for DB + WAL/shm files
* **Secure export controls** (prevent accidental plaintext export)
* **Integrity checks** (detect corrupted DB; prompt restore from backup)
* **Automated backup testing** (periodic restore validation)

### UX gaps

* **Guided onboarding**: build your tag dimensions early (vendor, dept, env)
* **Data validation**: prevent impossible recurrence rules
* **Explainable NLQ**: show the parsed filters so users trust results

---

## A pragmatic build plan (so this doesn’t sprawl)

1. **Core ledger**

* Services, vendors, expenses, recurrence, scenario

2. **Tag dimensions + reporting**

* dimension system + a handful of key reports

3. **Forecast materialization**

* generate monthly occurrences table; power charts + alerts

4. **Alerting engine**

* renewal/notice window alerts + dashboard

5. **Replacement workflow**

* retiring/replacement needed + candidate tracking

6. **Backup/restore + manifest**

* encrypted snapshot + “as-of” timestamps + restore UI

7. **NLQ**

* deterministic NLQ first; optional AI second

8. **Packaging**

* electron-builder (or Tauri) installers; auto-start/tray if needed

---

## My recommended stack (fits your requirements without exotic complexity)

If you want the cleanest TS-only build:

* **Shell:** Electron
* **UI:** React + TypeScript (Vite)
* **API/Domain:** Node.js (TypeScript), local-only API (or direct IPC)
* **DB:** SQLite file + encryption via `better-sqlite3-multiple-ciphers` (active, supports encryption + WAL) ([GitHub][9])
* **Migrations:** Drizzle (SQLite driver support) ([orm.drizzle.team][13])
* **Secrets:** Electron `safeStorage` for protecting the DB key ([Electron][10])
* **Backup:** `VACUUM INTO` / export strategy + manifest; grounded in SQLite’s backup guidance ([SQLite][12])
* **Installer:** electron-builder NSIS on Windows ([Electron Build][15])

If you’re okay with a tiny non-TS layer and want dependency handling on Windows to be “built-in”:

* Swap Electron → Tauri v2 and use its WebView2 install modes. ([Tauri][3])

---

If you want, I can follow up by giving you:

* a **concrete schema proposal** (tables + indexes + example queries for reports/NLQ),
* a **module breakdown** (frontend pages, backend services, job runner),
* and a **packaging/dependency checklist** for Windows/macOS/Linux (including how to keep backups encrypted and verifiable).

[1]: https://www.electronjs.org/releases?channel=stable "https://www.electronjs.org/releases?channel=stable"
[2]: https://www.npmjs.com/package/electron-builder "https://www.npmjs.com/package/electron-builder"
[3]: https://v2.tauri.app/distribute/windows-installer/ "https://v2.tauri.app/distribute/windows-installer/"
[4]: https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/encryption "https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/encryption"
[5]: https://github.com/sqlcipher/sqlcipher "https://github.com/sqlcipher/sqlcipher"
[6]: https://deepwiki.com/sqlcipher/sqlcipher/9.2-backup-and-export "https://deepwiki.com/sqlcipher/sqlcipher/9.2-backup-and-export"
[7]: https://www.zetetic.net/blog/2026/01/20/sqlcipher-4.13.0-release/ "https://www.zetetic.net/blog/2026/01/20/sqlcipher-4.13.0-release/"
[8]: https://github.com/journeyapps/node-sqlcipher "https://github.com/journeyapps/node-sqlcipher"
[9]: https://github.com/m4heshd/better-sqlite3-multiple-ciphers "https://github.com/m4heshd/better-sqlite3-multiple-ciphers"
[10]: https://www.electronjs.org/docs/latest/api/safe-storage "https://www.electronjs.org/docs/latest/api/safe-storage"
[11]: https://github.com/github/node-keytar "https://github.com/github/node-keytar"
[12]: https://sqlite.org/backup.html "https://sqlite.org/backup.html"
[13]: https://orm.drizzle.team/docs/get-started-sqlite "https://orm.drizzle.team/docs/get-started-sqlite"
[14]: https://nodejs.org/api/single-executable-applications.html "https://nodejs.org/api/single-executable-applications.html"
[15]: https://www.electron.build/nsis.html "https://www.electron.build/nsis.html"
