import { describe, expect, it } from "vitest";

import { buildTeamsWorkflowPayload, createTeamsWorkflowChannel } from "./teams-channel";

describe("teams workflow channel", () => {
  it("returns successful test-send and writes delivery log on valid webhook", async () => {
    const requests: Array<{ url: string; body: string }> = [];
    const channel = createTeamsWorkflowChannel({
      fetchImpl: async (url, init) => {
        requests.push({ url, body: init.body });
        return { ok: true, status: 202 };
      },
      nowIso: () => "2026-03-01T10:00:00.000Z"
    });

    const result = await channel.sendTest({
      enabled: true,
      webhookUrl: "https://example.invalid/teams"
    });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.health.status).toBe("healthy");
    expect(channel.getDeliveryLog()).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://example.invalid/teams");
  });

  it("retries failures with backoff and transitions health to degraded", async () => {
    const delays: number[] = [];
    const channel = createTeamsWorkflowChannel({
      fetchImpl: async () => {
        throw new Error("Network unavailable");
      },
      sleepImpl: async (delayMs) => {
        delays.push(delayMs);
      },
      nowIso: () => "2026-03-01T11:00:00.000Z",
      maxAttempts: 3,
      initialBackoffMs: 100
    });

    const result = await channel.sendAlert(
      {
        enabled: true,
        webhookUrl: "https://example.invalid/teams"
      },
      {
        title: "Renewal Alert",
        message: "Renewal for contract-8 is approaching.",
        entityType: "contract",
        entityId: "contract-8",
        fireAt: "2026-03-10"
      }
    );

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.health.status).toBe("degraded");
    expect(result.health.consecutiveFailures).toBe(1);
    expect(delays).toEqual([100, 200]);
  });

  it("formats readable workflow payload text and entity facts", () => {
    const payload = buildTeamsWorkflowPayload({
      title: "BudgetIT Renewal Alert",
      message: "Contract C-102 expires in 30 days.",
      entityType: "contract",
      entityId: "C-102",
      fireAt: "2026-04-01"
    }) as {
      attachments: Array<{
        content: {
          body: Array<{ text?: string; facts?: Array<{ title: string; value: string }> }>;
        };
      }>;
    };

    const body = payload.attachments[0]?.content.body ?? [];
    const textBlocks = body.map((entry) => entry.text).filter(Boolean);
    expect(textBlocks).toContain("BudgetIT Renewal Alert");
    expect(textBlocks).toContain("Contract C-102 expires in 30 days.");

    const factSet = body.find((entry) => Array.isArray(entry.facts));
    expect(factSet?.facts).toEqual([
      { title: "Entity", value: "contract:C-102" },
      { title: "Scheduled", value: "2026-04-01" }
    ]);
  });
});
