import { describe, expect, it } from "vitest";

import {
  buildHelpHashRoute,
  getApplicationMenuTemplate,
  bootstrapDesktop,
  DIAGNOSTICS_TRACKED_TABLES,
  parseApprovalCreatePayload,
  parseApprovalListPayload,
  parseExpenseListPayload,
  parseExportReportPayload,
  parseHelpOpenPayload,
  parsePickDirectoryDialogPayload,
  parsePickFileDialogPayload,
  parseReportPreviewPayload,
  parseReportsQueryPayload,
  parseScenarioSettingsPayload,
  parseShowbackListPayload,
  parseUnmatchedCreateExpensePayload,
  parseUnmatchedListPayload,
  parseUnmatchedReviewPayload
} from "./main";

describe("desktop bootstrap", () => {
  it("wires Help menu items to canonical help topics", () => {
    const helpCalls: Array<{ topic?: string; anchor?: string }> = [];
    const template = getApplicationMenuTemplate(() => undefined, {
      openHelp: (payload) => {
        helpCalls.push(payload);
      }
    });

    const helpMenu = template.find((item) => item.label === "Help");
    expect(helpMenu).toBeDefined();

    const submenu = helpMenu?.submenu;
    expect(Array.isArray(submenu)).toBe(true);
    const items = submenu as Array<{
      label?: string;
      accelerator?: string;
      click?: (...args: unknown[]) => void;
    }>;
    const helpCenter = items.find((item) => item.label === "Help Center");
    const shortcuts = items.find((item) => item.label === "Keyboard Shortcuts");

    expect(helpCenter?.accelerator).toBe("F1");
    expect(shortcuts).toBeDefined();

    helpCenter?.click?.();
    shortcuts?.click?.();

    expect(helpCalls).toEqual([
      { topic: "quick-start" },
      { topic: "global-keyboard-shortcuts" }
    ]);
  });

  it("preserves deep-link help query state for contextual help windows", () => {
    expect(
      parseHelpOpenPayload({
        topic: "vendors-form",
        anchor: "createedit-vendor-form",
        q: "vendor form",
        context: "vendors:form"
      })
    ).toEqual({
      topic: "vendors-form",
      anchor: "createedit-vendor-form",
      q: "vendor form",
      context: "vendors:form"
    });

    expect(
      buildHelpHashRoute({
        topic: "vendors-form",
        anchor: "createedit-vendor-form",
        q: "vendor form",
        context: "vendors:form"
      })
    ).toBe(
      "/help?topic=vendors-form&anchor=createedit-vendor-form&q=vendor+form&context=vendors%3Aform"
    );
  });

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

  it("accepts all supported reports.query values when scenarioId is explicit", () => {
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
      "actuals.unmatched.summary",
      "showback.summary",
      "dataQuality.summary",
      "maintenance.materialize",
      "maintenance.diagnostics"
    ] as const;

    for (const query of supported) {
      const parsed = parseReportsQueryPayload({ query, scenarioId: "baseline" });
      expect(parsed.query).toBe(query);
      expect(parsed.scenarioId).toBe("baseline");
    }

    const comparison = parseReportsQueryPayload({
      query: "scenario.comparison",
      scenarioId: "scenario-compare",
      baselineScenarioId: "baseline"
    });
    expect(comparison.query).toBe("scenario.comparison");
    expect(comparison.scenarioId).toBe("scenario-compare");
    expect(comparison.baselineScenarioId).toBe("baseline");

    expect(() => parseReportsQueryPayload({ query: "dashboard.summary" })).toThrow(
      /scenarioId/
    );
    expect(() =>
      parseReportsQueryPayload({
        query: "scenario.comparison",
        scenarioId: "scenario-compare"
      })
    ).toThrow(/baselineScenarioId/);
    expect(() => parseReportsQueryPayload({ query: "unknown.query", scenarioId: "baseline" })).toThrow(
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
        scenarioId: "baseline",
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
          scenarioId: "baseline",
          reportType: "unknown.report"
        },
        "C:\\exports\\default"
      )
    ).toThrow(/Unsupported export\.report reportType/);

    expect(() =>
      parseExportReportPayload(
        {
          scenarioId: "baseline",
          reportType: "dashboard.summary",
          formats: ["docx"]
        },
        "C:\\exports\\default"
      )
    ).toThrow(/Unsupported export\.report format/);

    expect(() =>
      parseExportReportPayload(
        {
          reportType: "dashboard.summary"
        },
        "C:\\exports\\default"
      )
    ).toThrow(/scenarioId/);
  });

  it("parses report preview payload and validates report types", () => {
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

    expect(() => parseReportPreviewPayload({ reportType: "dashboard.summary" })).toThrow(
      /scenarioId/
    );
    expect(() =>
      parseReportPreviewPayload({
        scenarioId: "scenario-2",
        reportType: "unknown.report"
      })
    ).toThrow(/Unsupported report\.preview reportType/);
  });

  it("requires explicit scenario context for unmatched actuals and scenario settings payloads", () => {
    expect(parseUnmatchedListPayload({ scenarioId: "baseline" })).toEqual({
      scenarioId: "baseline"
    });
    expect(() => parseUnmatchedListPayload({})).toThrow(/scenarioId/);

    expect(
      parseUnmatchedReviewPayload({
        transactionId: "txn-1",
        scenarioId: "baseline",
        disposition: "matched",
        matchedOccurrenceId: "occ-1"
      })
    ).toMatchObject({
      transactionId: "txn-1",
      scenarioId: "baseline",
      disposition: "matched",
      matchedOccurrenceId: "occ-1"
    });
    expect(() =>
      parseUnmatchedReviewPayload({
        transactionId: "txn-1",
        disposition: "ignored"
      })
    ).toThrow(/scenarioId/);

    expect(
      parseUnmatchedCreateExpensePayload({
        transactionId: "txn-1",
        scenarioId: "baseline",
        status: "actual"
      })
    ).toMatchObject({
      transactionId: "txn-1",
      scenarioId: "baseline",
      status: "actual"
    });
    expect(() =>
      parseUnmatchedCreateExpensePayload({
        transactionId: "txn-1"
      })
    ).toThrow(/scenarioId/);

    expect(parseScenarioSettingsPayload({ scenarioId: "baseline" }, "scenarioSettings.get")).toEqual({
      scenarioId: "baseline"
    });
    expect(() => parseScenarioSettingsPayload({}, "scenarioSettings.update")).toThrow(
      /scenarioId/
    );
  });

  it("requires explicit scenario context for expenses and approval payloads", () => {
    expect(
      parseExpenseListPayload({ scenarioId: "baseline", includeDeleted: true })
    ).toEqual({
      scenarioId: "baseline",
      includeDeleted: true
    });
    expect(() => parseExpenseListPayload({ includeDeleted: true })).toThrow(/scenarioId/);

    expect(
      parseApprovalListPayload({ scenarioId: "baseline", entityType: "scenario", limit: 20 })
    ).toEqual({
      scenarioId: "baseline",
      entityType: "scenario",
      limit: 20
    });
    expect(() => parseApprovalListPayload({ limit: 20 })).toThrow(/scenarioId/);

    expect(
      parseApprovalCreatePayload({
        scenarioId: "baseline",
        servicePlanId: "plan-1",
        entityType: "scenario",
        entityId: "baseline",
        action: "approve"
      })
    ).toMatchObject({
      scenarioId: "baseline",
      servicePlanId: "plan-1",
      entityType: "scenario",
      entityId: "baseline",
      action: "approve"
    });
    expect(() =>
      parseApprovalCreatePayload({
        entityType: "scenario",
        entityId: "baseline",
        action: "approve"
      })
    ).toThrow(/scenarioId/);
  });

  it("keeps showback list scenario filtering optional for global listing paths", () => {
    expect(parseShowbackListPayload(undefined)).toEqual({ includeLines: false });
    expect(parseShowbackListPayload({ includeLines: true })).toEqual({
      scenarioId: undefined,
      includeLines: true
    });
    expect(parseShowbackListPayload({ scenarioId: "baseline", includeLines: true })).toEqual({
      scenarioId: "baseline",
      includeLines: true
    });
  });

  it("normalizes native dialog payloads", () => {
    expect(
      parsePickFileDialogPayload({
        title: "Choose backup",
        defaultPath: "C:\\Backups",
        filters: [
          { name: "Backup DB", extensions: ["db", "sqlite"] },
          { name: "Ignored", extensions: ["", 4] }
        ]
      })
    ).toEqual({
      title: "Choose backup",
      defaultPath: "C:\\Backups",
      filters: [{ name: "Backup DB", extensions: ["db", "sqlite"] }]
    });
    expect(parsePickFileDialogPayload(null)).toEqual({});
    expect(
      parsePickDirectoryDialogPayload({
        title: "Choose export folder",
        defaultPath: "C:\\Exports"
      })
    ).toEqual({
      title: "Choose export folder",
      defaultPath: "C:\\Exports"
    });
    expect(parsePickDirectoryDialogPayload(undefined)).toEqual({});
  });

  it("tracks the expected diagnostics tables", () => {
    expect(DIAGNOSTICS_TRACKED_TABLES).toContain("spend_transaction");
    expect(DIAGNOSTICS_TRACKED_TABLES).not.toContain("transaction");
  });
});

