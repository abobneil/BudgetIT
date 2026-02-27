import { describe, expect, it } from "vitest";

import { generateRecurrencePreview } from "./recurrence-preview";

describe("recurrence preview", () => {
  it("handles month-end recurrence by clamping to valid day", () => {
    const preview = generateRecurrencePreview(
      {
        frequency: "monthly",
        interval: 1,
        dayOfMonth: 31,
        anchorDate: "2026-01-31"
      },
      4,
      "2026-01-01"
    );

    expect(preview).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30"
    ]);
  });

  it("applies interval step correctly for quarterly and yearly rules", () => {
    const quarterly = generateRecurrencePreview(
      {
        frequency: "quarterly",
        interval: 2,
        dayOfMonth: 30,
        anchorDate: "2026-01-15"
      },
      3,
      "2026-01-01"
    );
    expect(quarterly).toEqual(["2026-01-30", "2026-07-30", "2027-01-30"]);

    const yearly = generateRecurrencePreview(
      {
        frequency: "yearly",
        interval: 1,
        dayOfMonth: 29,
        anchorDate: "2024-02-29"
      },
      3,
      "2025-01-01"
    );
    expect(yearly).toEqual(["2025-02-28", "2026-02-28", "2027-02-28"]);
  });
});
