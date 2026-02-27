import type Database from "better-sqlite3-multiple-ciphers";

import {
  acknowledgeAlertEvent,
  listActionableAlertEventsForNotification,
  listAlertEvents,
  markAlertEventNotified,
  runAlertSchedulerTick,
  snoozeAlertEvent,
  unsnoozeAlertEvent,
  type AlertEventRecord
} from "@budgetit/db";

export type AlertNavigatePayload = {
  alertEventId: string;
  entityType: string;
  entityId: string;
};

export interface AlertStore {
  runSchedulerTick: (asOfIsoDate: string) => void;
  list: () => AlertEventRecord[];
  acknowledge: (alertEventId: string, acknowledgedAtIsoDate: string) => AlertEventRecord;
  snooze: (alertEventId: string, snoozedUntilIsoDate: string) => AlertEventRecord;
  unsnooze: (alertEventId: string) => AlertEventRecord;
  listActionableForNotification: (asOfIsoDate: string) => AlertEventRecord[];
  markNotified: (alertEventId: string, firedAtIsoDate: string) => void;
}

export function createDatabaseAlertStore(db: Database.Database): AlertStore {
  return {
    runSchedulerTick: (asOfIsoDate) => {
      runAlertSchedulerTick(db, asOfIsoDate);
    },
    list: () => listAlertEvents(db),
    acknowledge: (alertEventId, acknowledgedAtIsoDate) =>
      acknowledgeAlertEvent(db, alertEventId, acknowledgedAtIsoDate),
    snooze: (alertEventId, snoozedUntilIsoDate) =>
      snoozeAlertEvent(db, alertEventId, snoozedUntilIsoDate),
    unsnooze: (alertEventId) => unsnoozeAlertEvent(db, alertEventId),
    listActionableForNotification: (asOfIsoDate) =>
      listActionableAlertEventsForNotification(db, asOfIsoDate),
    markNotified: (alertEventId, firedAtIsoDate) =>
      markAlertEventNotified(db, alertEventId, firedAtIsoDate)
  };
}

export type AlertNotificationPublisher = (
  event: AlertEventRecord,
  onClick: () => void
) => void;

export function processAlertNotifications(
  store: AlertStore,
  asOfIsoDate: string,
  notify: AlertNotificationPublisher,
  onNavigate: (payload: AlertNavigatePayload) => void
): number {
  store.runSchedulerTick(asOfIsoDate);
  const pending = store.listActionableForNotification(asOfIsoDate);

  for (const event of pending) {
    notify(event, () => {
      onNavigate({
        alertEventId: event.id,
        entityType: event.entityType,
        entityId: event.entityId
      });
    });
    store.markNotified(event.id, asOfIsoDate);
  }

  return pending.length;
}
