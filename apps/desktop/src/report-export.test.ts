import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";

import {
  computeReportTotals,
  createDashboardHtml,
  exportDashboardReport
} from "./report-export";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-export-"));
  tempRoots.push(dir);
  return dir;
}

const dataset = {
  scenarioId: "baseline",
  staleForecast: false,
  spendTrend: [
    { month: "2026-01", forecastMinor: 10000, actualMinor: 10000 },
    { month: "2026-02", forecastMinor: 15000, actualMinor: 16000 },
    { month: "2026-03", forecastMinor: 15000, actualMinor: 15500 }
  ],
  renewals: [{ month: "2026-05", count: 1 }],
  growth: [
    { month: "2026-01", forecastMinor: 10000, growthPct: null },
    { month: "2026-02", forecastMinor: 15000, growthPct: 50 },
    { month: "2026-03", forecastMinor: 15000, growthPct: 0 }
  ],
  variance: [
    {
      month: "2026-01",
      forecastMinor: 10000,
      actualMinor: 10000,
      varianceMinor: 0,
      unmatchedActualMinor: 0,
      unmatchedCount: 0
    },
    {
      month: "2026-02",
      forecastMinor: 15000,
      actualMinor: 16000,
      varianceMinor: 1000,
      unmatchedActualMinor: 1000,
      unmatchedCount: 1
    },
    {
      month: "2026-03",
      forecastMinor: 15000,
      actualMinor: 15500,
      varianceMinor: 500,
      unmatchedActualMinor: 500,
      unmatchedCount: 1
    }
  ],
  taggingCompleteness: {
    totalExpenseLines: 2,
    taggedExpenseLines: 1,
    completenessRatio: 0.5
  },
  replacementStatus: {
    totalPlans: 2,
    replacementRequiredOpen: 1,
    byStatus: [
      { status: "approved", count: 1 },
      { status: "reviewed", count: 1 }
    ]
  },
  narrativeBlocks: [
    { id: "summary", title: "Spend Summary", body: "Summary body" },
    { id: "risks", title: "Risk Notes", body: "Risk body" }
  ]
};

describe("report export engine", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("generates all configured formats with non-zero size", async () => {
    const outputDir = createTempDir();
    const result = await exportDashboardReport(
      {
        dataset,
        outputDir,
        baseFileName: "dashboard",
        formats: ["html", "pdf", "excel", "csv", "png"]
      },
      {
        renderPdf: async () => Buffer.from("pdf-binary"),
        renderPng: async () => Buffer.from("png-binary")
      }
    );

    for (const filePath of Object.values(result.files)) {
      expect(filePath).toBeTruthy();
      const size = fs.statSync(filePath as string).size;
      expect(size).toBeGreaterThan(0);
    }
  });

  it("keeps exported totals aligned with dashboard totals", async () => {
    const outputDir = createTempDir();
    const totals = computeReportTotals(dataset);

    const result = await exportDashboardReport(
      {
        dataset,
        outputDir,
        baseFileName: "totals",
        formats: ["html", "csv", "excel"]
      },
      undefined
    );

    expect(result.totals).toEqual(totals);

    const csvPath = result.files.csv as string;
    const csvLines = fs.readFileSync(csvPath, "utf8").trim().split(/\r?\n/).slice(1);
    const csvForecast = csvLines.reduce((sum, line) => sum + Number.parseInt(line.split(",")[1], 10), 0);
    const csvActual = csvLines.reduce((sum, line) => sum + Number.parseInt(line.split(",")[2], 10), 0);
    expect(csvForecast).toBe(totals.forecastMinor);
    expect(csvActual).toBe(totals.actualMinor);

    const html = fs.readFileSync(result.files.html as string, "utf8");
    expect(html).toContain("Total forecast");
    expect(html).toContain("Total actual");
  });

  it("includes narrative sections in exported report artifacts", async () => {
    const outputDir = createTempDir();
    const html = createDashboardHtml(dataset);
    expect(html).toContain("Spend Summary");
    expect(html).toContain("Risk Notes");

    const result = await exportDashboardReport(
      {
        dataset,
        outputDir,
        baseFileName: "narrative",
        formats: ["excel"]
      },
      undefined
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(result.files.excel as string);
    const narrativeSheet = workbook.getWorksheet("Narrative");
    expect(narrativeSheet).toBeDefined();
    const titles = narrativeSheet
      ?.getColumn(1)
      .values.filter((value) => typeof value === "string") as string[];
    expect(titles).toContain("Spend Summary");
    expect(titles).toContain("Risk Notes");
  });
});
