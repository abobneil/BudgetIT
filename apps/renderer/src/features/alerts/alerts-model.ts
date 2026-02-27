import type { AlertRecord } from "../../lib/ipcClient";

export type AlertTabKey = "dueSoon" | "snoozed" | "acked" | "all";
export type AlertTimeBucket = "thisWeek" | "next30Days" | "later";
export type AlertSeverity = "high" | "medium" | "info";

export const ALERT_BUCKET_LABELS: Record<AlertTimeBucket, string> = {
  thisWeek: "This week",
  next30Days: "Next 30 days",
  later: "Later"
};

const ALERT_BUCKET_ORDER: AlertTimeBucket[] = ["thisWeek", "next30Days", "later"];

function toUtcDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function daysUntil(baseDate: Date, targetIsoDate: string): number {
  const base = toUtcDateOnly(baseDate);
  const target = parseIsoDate(targetIsoDate);
  const differenceMs = target.getTime() - base.getTime();
  return Math.floor(differenceMs / (24 * 60 * 60 * 1000));
}

export function resolveAlertTab(candidate: string | null): AlertTabKey {
  if (candidate === "snoozed" || candidate === "acked" || candidate === "all" || candidate === "dueSoon") {
    return candidate;
  }
  return "dueSoon";
}

export function filterAlertsByTab(alerts: AlertRecord[], tab: AlertTabKey): AlertRecord[] {
  if (tab === "all") {
    return [...alerts];
  }
  if (tab === "snoozed") {
    return alerts.filter((alert) => alert.status === "snoozed");
  }
  if (tab === "acked") {
    return alerts.filter((alert) => alert.status === "acked");
  }
  return alerts.filter((alert) => alert.status === "pending");
}

function getAlertTimeBucket(alert: AlertRecord, now: Date): AlertTimeBucket {
  const dayDelta = daysUntil(now, alert.fireAt);
  if (dayDelta <= 7) {
    return "thisWeek";
  }
  if (dayDelta <= 30) {
    return "next30Days";
  }
  return "later";
}

export type AlertBucketGroup = {
  bucket: AlertTimeBucket;
  label: string;
  alerts: AlertRecord[];
};

export function groupAlertsByTimeBucket(
  alerts: AlertRecord[],
  now: Date = new Date()
): AlertBucketGroup[] {
  const grouped: Record<AlertTimeBucket, AlertRecord[]> = {
    thisWeek: [],
    next30Days: [],
    later: []
  };

  const sortedAlerts = [...alerts].sort((left, right) => left.fireAt.localeCompare(right.fireAt));
  for (const alert of sortedAlerts) {
    grouped[getAlertTimeBucket(alert, now)].push(alert);
  }

  return ALERT_BUCKET_ORDER.map((bucket) => ({
    bucket,
    label: ALERT_BUCKET_LABELS[bucket],
    alerts: grouped[bucket]
  })).filter((group) => group.alerts.length > 0);
}

export function deriveAlertSeverity(alert: AlertRecord): AlertSeverity {
  const message = alert.message.toLowerCase();
  if (message.includes("[high]") || message.includes("deadline") || message.includes("expired")) {
    return "high";
  }
  if (message.includes("renewal") || message.includes("notice") || message.includes("due")) {
    return "medium";
  }
  return "info";
}

export function extractAlertReason(alert: AlertRecord): string {
  return alert.message.replace(/\[HIGH\]\s*/gi, "").trim();
}

export function recommendedNextActions(alert: AlertRecord): string[] {
  if (alert.status === "acked") {
    return [
      "No immediate triage required.",
      "Re-open related entity only if the situation changes."
    ];
  }

  if (alert.status === "snoozed") {
    return [
      "Track the snoozed-until date and re-evaluate before the due date.",
      "Unsnooze early if contract/vendor context has changed."
    ];
  }

  return [
    "Review the linked entity details and confirm upcoming deadlines.",
    "Acknowledge or snooze after triage to keep inbox focused."
  ];
}
