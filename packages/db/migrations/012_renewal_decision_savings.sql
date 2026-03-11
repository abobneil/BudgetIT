ALTER TABLE renewal_decision
ADD COLUMN current_amount_minor INTEGER NOT NULL DEFAULT 0;

ALTER TABLE renewal_decision
ADD COLUMN recurring_savings_minor INTEGER NOT NULL DEFAULT 0;

ALTER TABLE renewal_decision
ADD COLUMN avoided_future_cost_minor INTEGER NOT NULL DEFAULT 0;

ALTER TABLE renewal_decision
ADD COLUMN one_time_cost_minor INTEGER NOT NULL DEFAULT 0;

ALTER TABLE renewal_decision
ADD COLUMN savings_category TEXT;

ALTER TABLE renewal_decision
ADD COLUMN savings_rationale TEXT;

UPDATE meta
SET schema_version = 12,
    updated_at = CURRENT_TIMESTAMP;
