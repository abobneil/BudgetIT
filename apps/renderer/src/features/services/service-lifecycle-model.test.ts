import { describe, expect, it } from "vitest";

import {
  deriveServiceLifecycleState,
  isInRenewalWindow,
  renewalWindowLabel,
  serviceLifecycleTone,
  serviceRiskTone
} from "./service-lifecycle-model";

describe("service lifecycle model", () => {
  it("maps lifecycle and risk statuses to expected chip tones", () => {
    expect(serviceRiskTone("low")).toBe("success");
    expect(serviceRiskTone("medium")).toBe("warning");
    expect(serviceRiskTone("high")).toBe("danger");

    expect(serviceLifecycleTone("healthy")).toBe("success");
    expect(serviceLifecycleTone("renewal-window")).toBe("warning");
    expect(serviceLifecycleTone("notice-window")).toBe("warning");
    expect(serviceLifecycleTone("expired")).toBe("danger");
  });

  it("applies renewal window and lifecycle boundaries deterministically", () => {
    const referenceDate = "2026-03-01";

    expect(isInRenewalWindow("2026-04-30", referenceDate, 60)).toBe(true);
    expect(isInRenewalWindow("2026-05-01", referenceDate, 60)).toBe(false);
    expect(isInRenewalWindow("2026-02-28", referenceDate, 60)).toBe(false);

    expect(
      deriveServiceLifecycleState("2026-03-15", "low", referenceDate)
    ).toBe("notice-window");
    expect(
      deriveServiceLifecycleState("2026-02-20", "high", referenceDate)
    ).toBe("expired");
    expect(
      deriveServiceLifecycleState("2026-09-01", "low", referenceDate)
    ).toBe("healthy");

    expect(renewalWindowLabel("2026-03-01", referenceDate)).toBe("Renews today");
  });
});
