export type TeamsChannelSettings = {
  enabled: boolean;
  webhookUrl: string;
};

export type TeamsChannelHealth = {
  status: "unknown" | "healthy" | "degraded";
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
};

export type TeamsDeliveryLogEntry = {
  timestamp: string;
  outcome: "success" | "failure";
  attempt: number;
  statusCode: number | null;
  message: string;
};

export type TeamsDeliveryResult = {
  ok: boolean;
  attempts: number;
  statusCode: number | null;
  health: TeamsChannelHealth;
};

export type TeamsAlertInput = {
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  fireAt?: string;
};

type FetchResponseLike = {
  ok: boolean;
  status: number;
};

type FetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  }
) => Promise<FetchResponseLike>;

type TeamsChannelDependencies = {
  fetchImpl?: FetchLike;
  sleepImpl?: (delayMs: number) => Promise<void>;
  nowIso?: () => string;
  maxAttempts?: number;
  initialBackoffMs?: number;
};

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function cloneHealth(health: TeamsChannelHealth): TeamsChannelHealth {
  return {
    status: health.status,
    consecutiveFailures: health.consecutiveFailures,
    lastSuccessAt: health.lastSuccessAt,
    lastFailureAt: health.lastFailureAt,
    lastError: health.lastError
  };
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function buildTeamsWorkflowPayload(alert: TeamsAlertInput): Record<string, unknown> {
  const facts: Array<{ title: string; value: string }> = [];
  if (alert.entityType && alert.entityId) {
    facts.push({ title: "Entity", value: `${alert.entityType}:${alert.entityId}` });
  }
  if (alert.fireAt) {
    facts.push({ title: "Scheduled", value: alert.fireAt });
  }

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              size: "Medium",
              weight: "Bolder",
              text: alert.title
            },
            {
              type: "TextBlock",
              wrap: true,
              text: alert.message
            },
            ...(facts.length > 0
              ? [
                  {
                    type: "FactSet",
                    facts
                  }
                ]
              : [])
          ]
        }
      }
    ]
  };
}

export interface TeamsWorkflowChannel {
  sendTest: (settings: TeamsChannelSettings) => Promise<TeamsDeliveryResult>;
  sendAlert: (settings: TeamsChannelSettings, alert: TeamsAlertInput) => Promise<TeamsDeliveryResult>;
  getHealth: () => TeamsChannelHealth;
  getDeliveryLog: () => TeamsDeliveryLogEntry[];
}

export function createTeamsWorkflowChannel(
  dependencies: TeamsChannelDependencies = {}
): TeamsWorkflowChannel {
  const fetchImpl: FetchLike =
    dependencies.fetchImpl ??
    (async (input, init) => {
      const response = await fetch(input, init);
      return {
        ok: response.ok,
        status: response.status
      };
    });
  const sleepImpl = dependencies.sleepImpl ?? defaultSleep;
  const nowIso = dependencies.nowIso ?? (() => new Date().toISOString());
  const maxAttempts = dependencies.maxAttempts ?? 3;
  const initialBackoffMs = dependencies.initialBackoffMs ?? 200;

  const deliveryLog: TeamsDeliveryLogEntry[] = [];
  const health: TeamsChannelHealth = {
    status: "unknown",
    consecutiveFailures: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastError: null
  };

  async function deliver(
    settings: TeamsChannelSettings,
    alert: TeamsAlertInput
  ): Promise<TeamsDeliveryResult> {
    const webhookUrl = settings.webhookUrl.trim();
    if (webhookUrl.length === 0) {
      throw new Error("Teams webhook URL is required.");
    }

    const payload = buildTeamsWorkflowPayload(alert);
    let delayMs = initialBackoffMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetchImpl(webhookUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          health.status = "healthy";
          health.consecutiveFailures = 0;
          health.lastSuccessAt = nowIso();
          health.lastError = null;
          deliveryLog.push({
            timestamp: nowIso(),
            outcome: "success",
            attempt,
            statusCode: response.status,
            message: `Delivered Teams workflow payload: ${alert.title}`
          });
          return {
            ok: true,
            attempts: attempt,
            statusCode: response.status,
            health: cloneHealth(health)
          };
        }

        const failureMessage = `Teams webhook HTTP ${response.status}`;
        if (attempt === maxAttempts) {
          health.status = "degraded";
          health.consecutiveFailures += 1;
          health.lastFailureAt = nowIso();
          health.lastError = failureMessage;
          deliveryLog.push({
            timestamp: nowIso(),
            outcome: "failure",
            attempt,
            statusCode: response.status,
            message: failureMessage
          });
          return {
            ok: false,
            attempts: attempt,
            statusCode: response.status,
            health: cloneHealth(health)
          };
        }
      } catch (error) {
        if (attempt === maxAttempts) {
          const failureMessage = stringifyError(error);
          health.status = "degraded";
          health.consecutiveFailures += 1;
          health.lastFailureAt = nowIso();
          health.lastError = failureMessage;
          deliveryLog.push({
            timestamp: nowIso(),
            outcome: "failure",
            attempt,
            statusCode: null,
            message: failureMessage
          });
          return {
            ok: false,
            attempts: attempt,
            statusCode: null,
            health: cloneHealth(health)
          };
        }
      }

      await sleepImpl(delayMs);
      delayMs *= 2;
    }

    return {
      ok: false,
      attempts: maxAttempts,
      statusCode: null,
      health: cloneHealth(health)
    };
  }

  return {
    sendTest: async (settings) =>
      deliver(settings, {
        title: "BudgetIT Teams Test",
        message: "Teams channel test alert from BudgetIT."
      }),
    sendAlert: async (settings, alert) => {
      if (!settings.enabled) {
        return {
          ok: false,
          attempts: 0,
          statusCode: null,
          health: cloneHealth(health)
        };
      }
      return deliver(settings, alert);
    },
    getHealth: () => cloneHealth(health),
    getDeliveryLog: () => [...deliveryLog]
  };
}
