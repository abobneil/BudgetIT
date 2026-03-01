UPDATE service_plan
SET reason_code = LOWER(reason_code)
WHERE reason_code IS NOT NULL;

ALTER TABLE expense_line ADD COLUMN capex_opex TEXT;
ALTER TABLE expense_line ADD COLUMN gl_account_code TEXT;
ALTER TABLE expense_line ADD COLUMN cost_center_code TEXT;
ALTER TABLE expense_line ADD COLUMN funding_source TEXT;

ALTER TABLE vendor ADD COLUMN owner TEXT;
ALTER TABLE vendor ADD COLUMN annual_spend_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vendor ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE vendor ADD COLUMN risk TEXT NOT NULL DEFAULT 'low';

ALTER TABLE service ADD COLUMN annual_spend_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE service ADD COLUMN risk TEXT NOT NULL DEFAULT 'low';
ALTER TABLE service ADD COLUMN replacement_status TEXT NOT NULL DEFAULT 'not-started';

ALTER TABLE contract ADD COLUMN owner TEXT;
ALTER TABLE contract ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE contract ADD COLUMN renewal_action TEXT NOT NULL DEFAULT 'manual-review';

CREATE TABLE IF NOT EXISTS scenario_settings (
  scenario_id TEXT PRIMARY KEY,
  fiscal_year_start_month INTEGER NOT NULL DEFAULT 1,
  horizon_months INTEGER NOT NULL DEFAULT 24,
  default_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO scenario_settings (
  scenario_id,
  fiscal_year_start_month,
  horizon_months,
  default_currency
)
SELECT id, 1, 24, 'USD'
FROM scenario;

CREATE TABLE IF NOT EXISTS cost_center (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gl_account (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approval_record (
  id TEXT PRIMARY KEY,
  scenario_id TEXT,
  service_plan_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS unmatched_actual_review (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL UNIQUE,
  scenario_id TEXT NOT NULL,
  disposition TEXT NOT NULL,
  driver_tag TEXT,
  matched_occurrence_id TEXT,
  created_expense_line_id TEXT,
  reviewer TEXT NOT NULL,
  comment TEXT,
  reviewed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS showback_statement (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  group_by TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  total_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS showback_line (
  id TEXT PRIMARY KEY,
  statement_id TEXT NOT NULL,
  cost_center_code TEXT,
  owner_team TEXT,
  service_id TEXT,
  expense_line_id TEXT,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_showback_line_statement
ON showback_line (statement_id, cost_center_code, owner_team);

CREATE TABLE IF NOT EXISTS notification_endpoint (
  id TEXT PRIMARY KEY,
  endpoint_type TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_test_result TEXT,
  last_test_at TEXT,
  last_failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_unmatched_actual_review_scenario
ON unmatched_actual_review (scenario_id, reviewed_at);

CREATE INDEX IF NOT EXISTS idx_expense_line_finance_codes
ON expense_line (scenario_id, capex_opex, gl_account_code, cost_center_code);

UPDATE meta
SET schema_version = 9,
    updated_at = CURRENT_TIMESTAMP;
