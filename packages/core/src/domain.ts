export const SCENARIO_APPROVAL_STATUSES = ["draft", "reviewed", "approved"] as const;
export type ScenarioApprovalStatus = (typeof SCENARIO_APPROVAL_STATUSES)[number];

export const SCENARIO_DECISION_STATUSES = ["draft", "reviewed", "approved", "rejected"] as const;
export type ScenarioDecisionStatus = (typeof SCENARIO_DECISION_STATUSES)[number];

export const SERVICE_PLAN_ACTIONS = ["keep", "replace", "retire"] as const;
export type ServicePlanAction = (typeof SERVICE_PLAN_ACTIONS)[number];

export const SERVICE_PLAN_REASON_CODES = [
  "cost",
  "security",
  "eol",
  "consolidation",
  "performance",
  "other"
] as const;
export type ServicePlanReasonCode = (typeof SERVICE_PLAN_REASON_CODES)[number];

export const OCCURRENCE_STATES = ["forecast", "actualized"] as const;
export type OccurrenceState = (typeof OCCURRENCE_STATES)[number];

export const ALERT_RULE_TYPES = [
  "upcoming_payment",
  "renewal_window",
  "notice_window",
  "replacement_missing",
  "eol_date",
  "budget_threshold"
] as const;
export type AlertRuleType = (typeof ALERT_RULE_TYPES)[number];

const ISO_4217_CURRENCY_CODE = /^[A-Z]{3}$/;

export function isIso4217CurrencyCode(value: string): boolean {
  return ISO_4217_CURRENCY_CODE.test(value);
}

export function normalizeCurrencyCode(value: string): string {
  return value.trim().toUpperCase();
}
