import fs from "node:fs";
import path from "node:path";

import type { DashboardDataset } from "@budgetit/db";
import ExcelJS from "exceljs";

export type ExportFormat = "html" | "pdf" | "excel" | "csv" | "png";

export type ReportRenderers = {
  renderPdf: (html: string) => Promise<Buffer>;
  renderPng: (html: string) => Promise<Buffer>;
};

export type ReportExportInput = {
  dataset: DashboardDataset;
  outputDir: string;
  baseFileName?: string;
  formats?: ExportFormat[];
};

export type ReportExportResult = {
  totals: {
    forecastMinor: number;
    actualMinor: number;
    varianceMinor: number;
  };
  files: Partial<Record<ExportFormat, string>>;
};

function formatUsd(minor: number): string {
  return `$${(minor / 100).toFixed(2)}`;
}

export function computeReportTotals(dataset: DashboardDataset): {
  forecastMinor: number;
  actualMinor: number;
  varianceMinor: number;
} {
  return dataset.spendTrend.reduce(
    (totals, row) => {
      totals.forecastMinor += row.forecastMinor;
      totals.actualMinor += row.actualMinor;
      totals.varianceMinor += row.actualMinor - row.forecastMinor;
      return totals;
    },
    { forecastMinor: 0, actualMinor: 0, varianceMinor: 0 }
  );
}

export function createDashboardHtml(dataset: DashboardDataset): string {
  const totals = computeReportTotals(dataset);
  const staleText = dataset.staleForecast
    ? "<p><strong>Forecast is stale and should be re-materialized.</strong></p>"
    : "";
  const spendRows = dataset.spendTrend
    .map(
      (row) =>
        `<tr><td>${row.month}</td><td>${formatUsd(row.forecastMinor)}</td><td>${formatUsd(
          row.actualMinor
        )}</td></tr>`
    )
    .join("");
  const varianceRows = dataset.variance
    .map(
      (row) =>
        `<tr><td>${row.month}</td><td>${formatUsd(row.varianceMinor)}</td><td>${row.unmatchedCount}</td></tr>`
    )
    .join("");
  const narratives = dataset.narrativeBlocks
    .map((block) => `<section><h3>${block.title}</h3><p>${block.body}</p></section>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>BudgetIT Dashboard Report</title>
    <style>
      body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; color: #1f2937; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
      th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
      h1, h2, h3 { margin: 0 0 12px 0; }
      .summary { margin-bottom: 18px; }
    </style>
  </head>
  <body>
    <h1>BudgetIT Dashboard Report</h1>
    ${staleText}
    <div class="summary">
      <p>Total forecast: ${formatUsd(totals.forecastMinor)}</p>
      <p>Total actual: ${formatUsd(totals.actualMinor)}</p>
      <p>Total variance: ${formatUsd(totals.varianceMinor)}</p>
    </div>
    <h2>Spend Trend</h2>
    <table>
      <thead><tr><th>Month</th><th>Forecast</th><th>Actual</th></tr></thead>
      <tbody>${spendRows}</tbody>
    </table>
    <h2>Variance</h2>
    <table>
      <thead><tr><th>Month</th><th>Variance</th><th>Unmatched Count</th></tr></thead>
      <tbody>${varianceRows}</tbody>
    </table>
    <h2>Narrative</h2>
    ${narratives}
  </body>
</html>`;
}

function writeCsv(dataset: DashboardDataset, filePath: string): void {
  const lines = [
    "month,forecast_minor,actual_minor,variance_minor,unmatched_actual_minor,unmatched_count",
    ...dataset.variance.map(
      (row) =>
        `${row.month},${row.forecastMinor},${row.actualMinor},${row.varianceMinor},${row.unmatchedActualMinor},${row.unmatchedCount}`
    )
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

async function writeExcel(dataset: DashboardDataset, filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const spendSheet = workbook.addWorksheet("Spend Trend");
  spendSheet.addRow(["Month", "Forecast Minor", "Actual Minor"]);
  for (const row of dataset.spendTrend) {
    spendSheet.addRow([row.month, row.forecastMinor, row.actualMinor]);
  }

  const varianceSheet = workbook.addWorksheet("Variance");
  varianceSheet.addRow([
    "Month",
    "Forecast Minor",
    "Actual Minor",
    "Variance Minor",
    "Unmatched Actual Minor",
    "Unmatched Count"
  ]);
  for (const row of dataset.variance) {
    varianceSheet.addRow([
      row.month,
      row.forecastMinor,
      row.actualMinor,
      row.varianceMinor,
      row.unmatchedActualMinor,
      row.unmatchedCount
    ]);
  }

  const narrativeSheet = workbook.addWorksheet("Narrative");
  narrativeSheet.addRow(["Section", "Body"]);
  for (const block of dataset.narrativeBlocks) {
    narrativeSheet.addRow([block.title, block.body]);
  }

  await workbook.xlsx.writeFile(filePath);
}

function resolveFormats(input: ReportExportInput): ExportFormat[] {
  if (!input.formats || input.formats.length === 0) {
    return ["html", "pdf", "excel", "csv", "png"];
  }
  return input.formats;
}

export async function exportDashboardReport(
  input: ReportExportInput,
  renderers?: ReportRenderers
): Promise<ReportExportResult> {
  fs.mkdirSync(input.outputDir, { recursive: true });
  const formats = resolveFormats(input);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = input.baseFileName?.trim() || `budgetit-dashboard-${stamp}`;
  const files: Partial<Record<ExportFormat, string>> = {};
  const html = createDashboardHtml(input.dataset);

  if (formats.includes("html")) {
    const htmlPath = path.join(input.outputDir, `${baseName}.html`);
    fs.writeFileSync(htmlPath, html, "utf8");
    files.html = htmlPath;
  }

  if (formats.includes("csv")) {
    const csvPath = path.join(input.outputDir, `${baseName}.csv`);
    writeCsv(input.dataset, csvPath);
    files.csv = csvPath;
  }

  if (formats.includes("excel")) {
    const excelPath = path.join(input.outputDir, `${baseName}.xlsx`);
    await writeExcel(input.dataset, excelPath);
    files.excel = excelPath;
  }

  if (formats.includes("pdf")) {
    if (!renderers) {
      throw new Error("PDF export requires renderers.");
    }
    const pdfPath = path.join(input.outputDir, `${baseName}.pdf`);
    fs.writeFileSync(pdfPath, await renderers.renderPdf(html));
    files.pdf = pdfPath;
  }

  if (formats.includes("png")) {
    if (!renderers) {
      throw new Error("PNG export requires renderers.");
    }
    const pngPath = path.join(input.outputDir, `${baseName}.png`);
    fs.writeFileSync(pngPath, await renderers.renderPng(html));
    files.png = pngPath;
  }

  return {
    totals: computeReportTotals(input.dataset),
    files
  };
}
