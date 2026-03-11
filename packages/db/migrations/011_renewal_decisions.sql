CREATE TABLE IF NOT EXISTS renewal_decision (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  contract_id TEXT,
  action TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  expected_amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  notes TEXT,
  assumptions TEXT,
  source_snapshot_json TEXT NOT NULL,
  materialized_expense_line_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_renewal_decision_scope
ON renewal_decision (scenario_id, service_id, ifnull(contract_id, ''));

CREATE INDEX IF NOT EXISTS idx_renewal_decision_materialized_expense
ON renewal_decision (materialized_expense_line_id);
