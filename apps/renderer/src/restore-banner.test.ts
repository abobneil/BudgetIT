import { describe, expect, it } from "vitest";

import { formatRestoreBanner } from "./restore-banner";

describe("restore banner text", () => {
  it("renders source-as-of and restored timestamps for post-restore UX", () => {
    const text = formatRestoreBanner({
      sourceLastMutationAt: "2026-03-20T08:00:00.000Z",
      restoredAt: "2026-03-20T12:00:00.000Z",
      schemaVersion: 7
    });

    expect(text).toContain("Data current as of 2026-03-20T08:00:00.000Z");
    expect(text).toContain("restored 2026-03-20T12:00:00.000Z");
  });
});
