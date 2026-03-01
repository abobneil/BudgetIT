import { describe, expect, it } from "vitest";

import { humanizeTokenLabel, toTitleCaseLabel } from "./labelCase";

describe("labelCase", () => {
  it("humanizes slug and underscore values", () => {
    expect(humanizeTokenLabel("single_select")).toBe("single select");
    expect(humanizeTokenLabel("renewal-window")).toBe("renewal window");
  });

  it("converts labels to title case", () => {
    expect(toTitleCaseLabel("single_select")).toBe("Single Select");
    expect(toTitleCaseLabel("renewal-window")).toBe("Renewal Window");
  });

  it("preserves known acronyms and range tokens", () => {
    expect(toTitleCaseLabel("nlq workspace")).toBe("NLQ Workspace");
    expect(toTitleCaseLabel("export csv")).toBe("Export CSV");
    expect(toTitleCaseLabel("12m")).toBe("12M");
  });

  it("handles slash-delimited labels", () => {
    expect(toTitleCaseLabel("pdf/csv export")).toBe("PDF/CSV Export");
  });
});
