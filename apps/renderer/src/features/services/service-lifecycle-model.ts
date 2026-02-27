import type {
  ContractLifecycleStatus,
  ServiceRisk
} from "./service-contract-data";

type StatusTone = "success" | "warning" | "danger" | "info";
type ServiceLifecycleState = "healthy" | "renewal-window" | "notice-window" | "expired";

function parseUtcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function daysUntilDate(targetIsoDate: string, referenceIsoDate: string): number {
  const target = parseUtcDate(targetIsoDate).getTime();
  const reference = parseUtcDate(referenceIsoDate).getTime();
  return Math.round((target - reference) / (1000 * 60 * 60 * 24));
}

export function isInRenewalWindow(
  renewalIsoDate: string,
  referenceIsoDate: string,
  windowDays = 60
): boolean {
  const daysUntilRenewal = daysUntilDate(renewalIsoDate, referenceIsoDate);
  return daysUntilRenewal >= 0 && daysUntilRenewal <= windowDays;
}

export function deriveServiceLifecycleState(
  renewalIsoDate: string,
  risk: ServiceRisk,
  referenceIsoDate: string
): ServiceLifecycleState {
  const daysUntilRenewal = daysUntilDate(renewalIsoDate, referenceIsoDate);

  if (daysUntilRenewal < 0) {
    return "expired";
  }
  if (daysUntilRenewal <= 30) {
    return "notice-window";
  }
  if (daysUntilRenewal <= 90 || risk === "high") {
    return "renewal-window";
  }
  return "healthy";
}

export function serviceLifecycleTone(state: ServiceLifecycleState): StatusTone {
  if (state === "expired") {
    return "danger";
  }
  if (state === "notice-window" || state === "renewal-window") {
    return "warning";
  }
  return "success";
}

export function serviceRiskTone(risk: ServiceRisk): StatusTone {
  if (risk === "high") {
    return "danger";
  }
  if (risk === "medium") {
    return "warning";
  }
  return "success";
}

export function contractLifecycleTone(status: ContractLifecycleStatus): StatusTone {
  if (status === "expired") {
    return "danger";
  }
  if (status === "notice-window" || status === "renewal-window") {
    return "warning";
  }
  return "info";
}

export function renewalWindowLabel(renewalIsoDate: string, referenceIsoDate: string): string {
  const daysUntilRenewal = daysUntilDate(renewalIsoDate, referenceIsoDate);
  if (daysUntilRenewal < 0) {
    return `${Math.abs(daysUntilRenewal)} day(s) overdue`;
  }
  if (daysUntilRenewal === 0) {
    return "Renews today";
  }
  return `${daysUntilRenewal} day(s) to renewal`;
}
