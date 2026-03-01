import { describe, expect, it } from "vitest";

import {
  bootstrapDesktop,
  DIAGNOSTICS_TRACKED_TABLES,
  parseExportReportPayload,
  parseReportPreviewPayload,
  parseReportsQueryPayload
} from "./main";

describe("desktop bootstrap", () => {
  it("runs app boot smoke behavior and creates initial window", async () => {
    let activateCallback: (() => void) | undefined;
    let windowsOpen = 0;
    let createWindowCalls = 0;

    await bootstrapDesktop({
      whenReady: async () => undefined,
      createWindow: () => {
        windowsOpen += 1;
        createWindowCalls += 1;
      },
      onActivate: (callback) => {
        activateCallback = callback;
      },
      onAllWindowsClosed: () => undefined,
      hasOpenWindows: () => windowsOpen > 0,
      quit: () => undefined,
      platform: "win32"
    });

    expect(createWindowCalls).toBe(1);
    expect(activateCallback).toBeTypeOf("function");

    if (activateCallback) {
      activateCallback();
      expect(createWindowCalls).toBe(1);

      windowsOpen = 0;
      activateCallback();
      expect(createWindowCalls).toBe(2);
    }
  });

  it("quits app when all windows are closed on non-macOS platforms", async () => {
    let allWindowsClosedCallback: (() => void) | undefined;
    let quitCalls = 0;

    await bootstrapDesktop({
      whenReady: async () => undefined,
      createWindow: () => undefined,
      onActivate: () => undefined,
      onAllWindowsClosed: (callback) => {
        allWindowsClosedCallback = callback;
      },
      hasOpenWindows: () => false,
      quit: () => {
        quitCalls += 1;
      },
      platform: "win32"
    });

    expect(allWindowsClosedCallback).toBeTypeOf("function");
    if (allWindowsClosedCallback) {
      allWindowsClosedCallback();
    }

    expect(quitCalls).toBe(1);
  });

  it("accepts all supported reports.query values", () => {
    const supported = [
      "dashboard.summary",
      "renewals.timeline",
      "spend.byTag",
      "spend.byVendor",
      "replacement.pipeline",
      "tagging.completeness",
      "nlq.saved",
      "variance.monthly",
      "replacement.detail",
      "scenario.comparison",
      "actuals.unmatched.summary",
      "showback.summary",
      "dataQuality.summary",
      "maintenance.materialize",
      "maintenance.diagnostics"
    ] as const;

    for (const query of supported) {
      const parsed = parseReportsQueryPayload({ query });
      expect(parsed.query).toBe(query);
      expect(parsed.scenarioId).toBe("baseline");
    }

    expect(() => parseReportsQueryPayload({ query: "unknown.query" })).toThrow(
      /Unsupported reports\.query/
    );
  });

  it("parses canonical and legacy export payload destination keys", () => {
    const parsedCanonical = parseExportReportPayload(
      {
        scenarioId: "baseline",
        reportType: "spend.byVendor",
        outputDir: "C:\\exports\\canonical",
        formats: ["csv"]
      },
      "C:\\exports\\default"
    );
    expect(parsedCanonical.outputDir).toBe("C:\\exports\\canonical");
    expect(parsedCanonical.reportType).toBe("spend.byVendor");

    const parsedLegacy = parseExportReportPayload(
      {
        reportType: "dashboard.summary",
        destinationPath: "C:\\exports\\legacy",
        formats: ["pdf"]
      },
      "C:\\exports\\default"
    );
    expect(parsedLegacy.outputDir).toBe("C:\\exports\\legacy");
    expect(parsedLegacy.reportType).toBe("dashboard.summary");

    expect(() =>
      parseExportReportPayload(
        {
          reportType: "unknown.report"
        },
        "C:\\exports\\default"
      )
    ).toThrow(/Unsupported export\.report reportType/);

    expect(() =>
      parseExportReportPayload(
        {
          reportType: "dashboard.summary",
          formats: ["docx"]
        },
        "C:\\exports\\default"
      )
    ).toThrow(/Unsupported export\.report format/);
  });

  it("parses report preview payload and validates report types", () => {
    const parsedDefault = parseReportPreviewPayload({});
    expect(parsedDefault.scenarioId).toBe("baseline");
    expect(parsedDefault.reportType).toBe("dashboard.summary");

    const parsedConfigured = parseReportPreviewPayload({
      scenarioId: "scenario-2",
      reportType: "spend.byTag",
      filters: {
        dateFrom: "2026-01-01",
        dateTo: "2026-12-31",
        tag: "security"
      }
    });
    expect(parsedConfigured.scenarioId).toBe("scenario-2");
    expect(parsedConfigured.reportType).toBe("spend.byTag");
    expect(parsedConfigured.filters).toEqual({
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      tag: "security"
    });

    expect(() =>
      parseReportPreviewPayload({
        reportType: "unknown.report"
      })
    ).toThrow(/Unsupported report\.preview reportType/);
  });

  it("tracks the expected diagnostics tables", () => {
    expect(DIAGNOSTICS_TRACKED_TABLES).toContain("spend_transaction");
    expect(DIAGNOSTICS_TRACKED_TABLES).not.toContain("transaction");
  });
});

