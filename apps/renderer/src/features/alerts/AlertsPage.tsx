import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Tab,
  TabList,
  Text,
  Title3
} from "@fluentui/react-components";
import { useSearchParams } from "react-router-dom";

import {
  acknowledgeAlert,
  listAlerts,
  onAlertNavigate,
  snoozeAlert,
  type AlertRecord
} from "../../lib/ipcClient";
import { EmptyState, InlineError, PageHeader, StatusChip } from "../../ui/primitives";
import {
  deriveAlertSeverity,
  extractAlertReason,
  filterAlertsByTab,
  groupAlertsByTimeBucket,
  recommendedNextActions,
  resolveAlertTab,
  type AlertTabKey,
  type AlertSeverity
} from "./alerts-model";
import "./AlertsPage.css";

const TAB_LABELS: Record<AlertTabKey, string> = {
  dueSoon: "Due soon",
  snoozed: "Snoozed",
  acked: "Acked",
  all: "All"
};

function addDaysToIsoDate(days: number): string {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatDueDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function severityToTone(
  severity: AlertSeverity
): "danger" | "warning" | "info" {
  if (severity === "high") {
    return "danger";
  }
  if (severity === "medium") {
    return "warning";
  }
  return "info";
}

function statusToTone(status: AlertRecord["status"]): "info" | "warning" | "success" {
  if (status === "acked") {
    return "success";
  }
  if (status === "snoozed") {
    return "warning";
  }
  return "info";
}

function buildNextQuery(searchParams: URLSearchParams, updates: Record<string, string | null>): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  for (const [key, value] of Object.entries(updates)) {
    if (!value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  return next;
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [busyAlertId, setBusyAlertId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = resolveAlertTab(searchParams.get("tab"));
  const focusedAlertId = searchParams.get("alert");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const nextAlerts = await listAlerts();
        if (cancelled) {
          return;
        }
        setAlerts(nextAlerts);
      } catch (loadError) {
        const detail = loadError instanceof Error ? loadError.message : String(loadError);
        setError(`Failed to load alerts: ${detail}`);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAlertNavigate((payload) => {
      setActionStatus(`Focused alert ${payload.alertEventId} for ${payload.entityType}:${payload.entityId}.`);
      setSearchParams(
        (current) =>
          buildNextQuery(current, {
            tab: "all",
            alert: payload.alertEventId
          }),
        { replace: false }
      );
    });
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [setSearchParams]);

  const tabCounts = useMemo(
    () => ({
      dueSoon: filterAlertsByTab(alerts, "dueSoon").length,
      snoozed: filterAlertsByTab(alerts, "snoozed").length,
      acked: filterAlertsByTab(alerts, "acked").length,
      all: alerts.length
    }),
    [alerts]
  );

  const visibleAlerts = useMemo(
    () => filterAlertsByTab(alerts, activeTab),
    [alerts, activeTab]
  );
  const groupedAlerts = useMemo(
    () => groupAlertsByTimeBucket(visibleAlerts),
    [visibleAlerts]
  );

  const focusedAlert = useMemo(() => {
    if (focusedAlertId) {
      return alerts.find((alert) => alert.id === focusedAlertId) ?? null;
    }
    return visibleAlerts[0] ?? null;
  }, [alerts, focusedAlertId, visibleAlerts]);

  function focusAlert(alertId: string): void {
    setSearchParams(
      (current) => buildNextQuery(current, { alert: alertId }),
      { replace: false }
    );
  }

  async function handleAck(alertId: string): Promise<void> {
    setBusyAlertId(alertId);
    try {
      const updated = await acknowledgeAlert(alertId);
      setAlerts((current) =>
        current.map((alert) => (alert.id === alertId ? updated : alert))
      );
      setActionStatus(`Alert ${alertId} acknowledged.`);
    } catch (actionError) {
      const detail = actionError instanceof Error ? actionError.message : String(actionError);
      setError(`Failed to acknowledge alert: ${detail}`);
    } finally {
      setBusyAlertId(null);
    }
  }

  async function handleSnooze(alertId: string, days: number): Promise<void> {
    const snoozedUntil = addDaysToIsoDate(days);
    setBusyAlertId(alertId);
    try {
      const updated = await snoozeAlert(alertId, snoozedUntil);
      setAlerts((current) =>
        current.map((alert) => (alert.id === alertId ? updated : alert))
      );
      setActionStatus(`Alert ${alertId} snoozed until ${snoozedUntil}.`);
    } catch (actionError) {
      const detail = actionError instanceof Error ? actionError.message : String(actionError);
      setError(`Failed to snooze alert: ${detail}`);
    } finally {
      setBusyAlertId(null);
    }
  }

  function handleOpenEntity(alert: AlertRecord): void {
    focusAlert(alert.id);
    setActionStatus(`Open entity ${alert.entityType}:${alert.entityId}.`);
  }

  return (
    <section className="alerts-page">
      <PageHeader
        title="Alerts Inbox"
        subtitle="Actionable inbox for due, snoozed, and acknowledged alerts."
      />

      <TabList
        selectedValue={activeTab}
        onTabSelect={(_event, data) => {
          setSearchParams(
            (current) =>
              buildNextQuery(current, { tab: String(data.value), alert: focusedAlertId }),
            { replace: false }
          );
        }}
      >
        <Tab value="dueSoon">{`${TAB_LABELS.dueSoon} (${tabCounts.dueSoon})`}</Tab>
        <Tab value="snoozed">{`${TAB_LABELS.snoozed} (${tabCounts.snoozed})`}</Tab>
        <Tab value="acked">{`${TAB_LABELS.acked} (${tabCounts.acked})`}</Tab>
        <Tab value="all">{`${TAB_LABELS.all} (${tabCounts.all})`}</Tab>
      </TabList>

      {error ? <InlineError message={error} /> : null}
      {actionStatus ? <Text>{actionStatus}</Text> : null}

      <div className="alerts-layout">
        <section className="alerts-list">
          {loading ? (
            <Card>
              <Text>Loading alerts...</Text>
            </Card>
          ) : groupedAlerts.length === 0 ? (
            <EmptyState
              title="No alerts in this tab"
              description="You're clear for the selected triage view."
            />
          ) : (
            groupedAlerts.map((group) => (
              <section className="alerts-group" key={group.bucket}>
                <Title3>{group.label}</Title3>
                <ul className="alerts-group__items">
                  {group.alerts.map((alert) => {
                    const severity = deriveAlertSeverity(alert);
                    const isFocused = focusedAlert?.id === alert.id;
                    return (
                      <li key={alert.id}>
                        <Card
                          className={isFocused ? "alerts-row alerts-row--focused" : "alerts-row"}
                        >
                          <div className="alerts-row__meta">
                            <StatusChip
                              label={severity.toUpperCase()}
                              tone={severityToTone(severity)}
                            />
                            <StatusChip
                              label={alert.status.toUpperCase()}
                              tone={statusToTone(alert.status)}
                            />
                            <Text>{formatDueDate(alert.fireAt)}</Text>
                          </div>
                          <Text>{alert.message}</Text>
                          <div className="alerts-row__actions">
                            <Button
                              size="small"
                              appearance="secondary"
                              onClick={() => focusAlert(alert.id)}
                            >
                              Review
                            </Button>
                            <Button
                              size="small"
                              appearance="secondary"
                              disabled={alert.status === "acked" || busyAlertId === alert.id}
                              onClick={() => void handleAck(alert.id)}
                            >
                              Ack
                            </Button>
                            <Button
                              size="small"
                              appearance="secondary"
                              disabled={alert.status === "acked" || busyAlertId === alert.id}
                              onClick={() => void handleSnooze(alert.id, 7)}
                            >
                              Snooze until +7d
                            </Button>
                            <Button
                              size="small"
                              appearance="secondary"
                              onClick={() => handleOpenEntity(alert)}
                            >
                              Open entity
                            </Button>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </section>

        <aside className="alerts-detail">
          {focusedAlert ? (
            <Card>
              <Title3>Alert Detail</Title3>
              <Text>{focusedAlert.message}</Text>
              <Text>{`Due: ${formatDueDate(focusedAlert.fireAt)}`}</Text>
              <Text>{`Related entity: ${focusedAlert.entityType}:${focusedAlert.entityId}`}</Text>
              <Text>{`Trigger reason: ${extractAlertReason(focusedAlert)}`}</Text>
              <Text weight="semibold">Recommended next actions</Text>
              <ul>
                {recommendedNextActions(focusedAlert).map((item) => (
                  <li key={item}>
                    <Text>{item}</Text>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <EmptyState
              title="No alert selected"
              description="Select an alert from the inbox to inspect details."
            />
          )}
        </aside>
      </div>
    </section>
  );
}
