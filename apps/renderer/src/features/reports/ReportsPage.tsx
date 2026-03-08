import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Title3
} from "@fluentui/react-components";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridApi, GridReadyEvent } from "ag-grid-community";
import { useNavigate } from "react-router-dom";

import type { DashboardDataset } from "../../reporting";
import {
  createExpenseFromUnmatchedActual,
  exportReport,
  exportShowbackStatement,
  generateShowbackStatement,
  isIpcAvailable,
  listUnmatchedActuals,
  pickDirectoryPath,
  previewReport,
  queryReport,
  reviewUnmatchedActual,
  type ShowbackStatement,
  type UnmatchedActualItem
} from "../../lib/ipcClient";
import { isAgGridAvailable } from "../../lib/agGrid";
import { formatCurrencyMinor, resolveDisplayCurrency } from "../../lib/currency";
import { currentMonthDateRange, currentYearDateRange } from "../../lib/dateDefaults";
import { useFeedback } from "../../ui/feedback";
import {
  EmptyState,
  ErrorBoundary,
  InlineError,
  LoadingState,
  PageHeader
} from "../../ui/primitives";
import { toTitleCaseLabel } from "../../ui/text/labelCase";
import { useScenarioContext } from "../scenarios/ScenarioContext";
import {
  DEFAULT_REPORT_PRESETS,
  loadSavedReportPresets,
  saveReportPreset,
  type ReportPreset
} from "./reports-config-model";
import { buildHelpHashPath } from "../help/help-topics";
import "./ReportsPage.css";

type ReportFormat = "html" | "pdf" | "excel" | "csv" | "png";
type ExportJob = {
  id: string;
  format: ReportFormat;
  destination: string;
  status: "running" | "succeeded" | "failed";
  outputPath: string | null;
  error: string | null;
};

const EXPORT_FORMATS: ReportFormat[] = ["html", "pdf", "excel", "csv", "png"];

type UnmatchedSummary = {
  scenarioId: string;
  unmatchedCount: number;
  unmatchedAmountMinor: number;
  drivers: Array<{ driverTag: string; count: number }>;
};

type DataQualitySummary = {
  scenarioId: string;
  expenseCount: number;
  missingCostCenterCount: number;
  missingGlAccountCount: number;
  missingCapexOpexCount: number;
  missingRequiredTagCount: number;
};

export function ReportsPage() {
  const hasIpc = isIpcAvailable();
  const useAgGrid = isAgGridAvailable();
  const navigate = useNavigate();
  const { selectedScenarioId, selectedScenario } = useScenarioContext();
  const { notify } = useFeedback();
  const defaultYearRange = useMemo(() => currentYearDateRange(), []);
  const defaultMonthRange = useMemo(() => currentMonthDateRange(), []);
  const [savedPresets, setSavedPresets] = useState(() => loadSavedReportPresets());
  const [selectedPresetId, setSelectedPresetId] = useState(
    DEFAULT_REPORT_PRESETS[0]?.id ?? ""
  );
  const [dateFrom, setDateFrom] = useState(defaultYearRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultYearRange.dateTo);
  const [tagFilter, setTagFilter] = useState("all");
  const [visualizations, setVisualizations] = useState(
    DEFAULT_REPORT_PRESETS[0]?.visualizations ?? {
      table: true,
      chart: true,
      gauge: true,
      narrative: true
    }
  );
  const [dataset, setDataset] = useState<DashboardDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ReportFormat>("pdf");
  const [destinationPath, setDestinationPath] = useState("");
  const [destinationConfirmed, setDestinationConfirmed] = useState(false);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [savePresetName, setSavePresetName] = useState("");
  const [unmatchedSummary, setUnmatchedSummary] = useState<UnmatchedSummary | null>(null);
  const [unmatchedItems, setUnmatchedItems] = useState<UnmatchedActualItem[]>([]);
  const [unmatchedSelectionByTxn, setUnmatchedSelectionByTxn] = useState<Record<string, string>>(
    {}
  );
  const [unmatchedDriverByTxn, setUnmatchedDriverByTxn] = useState<
    Record<string, "timing" | "price" | "scope">
  >({});
  const [unmatchedCommentByTxn, setUnmatchedCommentByTxn] = useState<Record<string, string>>({});
  const [unmatchedBusyTxn, setUnmatchedBusyTxn] = useState<string | null>(null);
  const [showbackPeriodStart, setShowbackPeriodStart] = useState(defaultMonthRange.dateFrom);
  const [showbackPeriodEnd, setShowbackPeriodEnd] = useState(defaultMonthRange.dateTo);
  const [showbackGroupBy, setShowbackGroupBy] = useState<"cost_center" | "team">("cost_center");
  const [showbackStatements, setShowbackStatements] = useState<ShowbackStatement[]>([]);
  const [showbackOutputDir, setShowbackOutputDir] = useState("");
  const [showbackBusy, setShowbackBusy] = useState<"generate" | "export" | null>(null);
  const [showbackExportedFiles, setShowbackExportedFiles] = useState<
    Record<string, Partial<Record<"csv" | "xlsx", string>>>
  >({});
  const [dataQualitySummary, setDataQualitySummary] = useState<DataQualitySummary | null>(null);
  const [unmatchedGridApi, setUnmatchedGridApi] = useState<GridApi<UnmatchedActualItem> | null>(
    null
  );
  const [showbackGridApi, setShowbackGridApi] = useState<GridApi<ShowbackStatement> | null>(null);
  const exportSectionRef = useRef<HTMLElement | null>(null);
  const narrativeSectionRef = useRef<HTMLElement | null>(null);

  const presets = useMemo(() => {
    const byId = new Map<string, ReportPreset>();
    for (const preset of DEFAULT_REPORT_PRESETS) {
      byId.set(preset.id, preset);
    }
    for (const preset of savedPresets) {
      byId.set(preset.id, preset);
    }
    return Array.from(byId.values());
  }, [savedPresets]);
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? presets[0];
  const reportCurrency = dataset?.currency ?? "USD";

  const unmatchedGridColumns = useMemo<ColDef<UnmatchedActualItem>[]>(
    () => [
      {
        headerName: "Date",
        field: "transactionDate",
        sortable: true,
        filter: "agDateColumnFilter",
        minWidth: 125
      },
      {
        headerName: "Amount",
        field: "amountMinor",
        sortable: true,
        filter: "agNumberColumnFilter",
        minWidth: 140,
        valueFormatter: (params) =>
          formatCurrencyMinor(Number(params.value ?? 0), params.data?.currency, reportCurrency)
      },
      {
        headerName: "Description",
        field: "description",
        sortable: true,
        filter: "agTextColumnFilter",
        minWidth: 220,
        valueGetter: (params) => params.data?.description ?? "No description"
      },
      {
        headerName: "Suggested match",
        field: "id",
        sortable: false,
        filter: false,
        minWidth: 230,
        cellRenderer: (params: { data?: UnmatchedActualItem }) => {
          const item = params.data;
          if (!item) {
            return null;
          }
          return (
            <Select
              aria-label={`Unmatched suggestion ${item.id}`}
              value={unmatchedSelectionByTxn[item.id] ?? ""}
              onChange={(event) =>
                setUnmatchedSelectionByTxn((current) => ({
                  ...current,
                  [item.id]: event.target.value
                }))
              }
            >
              <option value="">No match selected</option>
              {item.suggestions.map((suggestion) => (
                <option key={suggestion.occurrenceId} value={suggestion.occurrenceId}>
                  {`${suggestion.occurrenceDate} | ${(suggestion.amountMinor / 100).toFixed(2)} ${suggestion.currency}`}
                </option>
              ))}
            </Select>
          );
        }
      },
      {
        headerName: "Driver + comment",
        field: "id",
        sortable: false,
        filter: false,
        minWidth: 245,
        cellRenderer: (params: { data?: UnmatchedActualItem }) => {
          const item = params.data;
          if (!item) {
            return null;
          }
          return (
            <div className="reports-grid-cell-stack">
              <Select
                aria-label={`Unmatched driver ${item.id}`}
                value={unmatchedDriverByTxn[item.id] ?? ""}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setUnmatchedDriverByTxn((current) => {
                    if (
                      nextValue !== "timing" &&
                      nextValue !== "price" &&
                      nextValue !== "scope"
                    ) {
                      const next = { ...current };
                      delete next[item.id];
                      return next;
                    }
                    return {
                      ...current,
                      [item.id]: nextValue
                    };
                  });
                }}
              >
                <option value="">None</option>
                <option value="timing">{toTitleCaseLabel("timing")}</option>
                <option value="price">{toTitleCaseLabel("price")}</option>
                <option value="scope">{toTitleCaseLabel("scope")}</option>
              </Select>
              <Input
                aria-label={`Unmatched comment ${item.id}`}
                placeholder="Optional comment"
                value={unmatchedCommentByTxn[item.id] ?? ""}
                onChange={(_event, data) =>
                  setUnmatchedCommentByTxn((current) => ({
                    ...current,
                    [item.id]: data.value
                  }))
                }
              />
            </div>
          );
        }
      },
      {
        headerName: "Actions",
        field: "id",
        sortable: false,
        filter: false,
        minWidth: 310,
        cellRenderer: (params: { data?: UnmatchedActualItem }) => {
          const item = params.data;
          if (!item) {
            return null;
          }
          return (
            <div className="reports-export-controls__actions">
              <Button
                size="small"
                appearance="secondary"
                disabled={
                  !hasIpc ||
                  unmatchedBusyTxn !== null ||
                  !Boolean(unmatchedSelectionByTxn[item.id])
                }
                onClick={() => void resolveUnmatchedActual(item, "matched")}
              >
                Match
              </Button>
              <Button
                size="small"
                appearance="secondary"
                disabled={!hasIpc || unmatchedBusyTxn !== null}
                onClick={() => void resolveUnmatchedActual(item, "rejected")}
              >
                Reject
              </Button>
              <Button
                size="small"
                appearance="secondary"
                disabled={!hasIpc || unmatchedBusyTxn !== null}
                onClick={() => void resolveUnmatchedActual(item, "ignored")}
              >
                Ignore
              </Button>
              <Button
                size="small"
                appearance="primary"
                disabled={!hasIpc || unmatchedBusyTxn !== null}
                onClick={() => void resolveUnmatchedActual(item, "create_expense")}
              >
                Create Expense
              </Button>
            </div>
          );
        }
      }
    ],
    [
      hasIpc,
      reportCurrency,
      unmatchedBusyTxn,
      unmatchedCommentByTxn,
      unmatchedDriverByTxn,
      unmatchedSelectionByTxn
    ]
  );

  const showbackGridColumns = useMemo<ColDef<ShowbackStatement>[]>(
    () => [
      {
        headerName: "Period",
        field: "periodStart",
        sortable: true,
        filter: "agTextColumnFilter",
        minWidth: 190,
        valueGetter: (params) => `${params.data?.periodStart} to ${params.data?.periodEnd}`
      },
      {
        headerName: "Group By",
        field: "groupBy",
        sortable: true,
        filter: "agTextColumnFilter",
        minWidth: 120
      },
      {
        headerName: "Total",
        field: "totalMinor",
        sortable: true,
        filter: "agNumberColumnFilter",
        minWidth: 150,
        valueFormatter: (params) =>
          formatCurrencyMinor(
            Number(params.value ?? 0),
            resolveDisplayCurrency(params.data?.currency, reportCurrency),
            reportCurrency
          )
      },
      {
        headerName: "Lines",
        field: "lineCount",
        sortable: true,
        filter: "agNumberColumnFilter",
        minWidth: 100,
        valueGetter: (params) => params.data?.lineCount ?? params.data?.lines?.length ?? 0
      },
      {
        headerName: "Actions",
        field: "id",
        sortable: false,
        filter: false,
        minWidth: 320,
        cellRenderer: (params: { data?: ShowbackStatement }) => {
          const statement = params.data;
          if (!statement) {
            return null;
          }
          return (
            <div className="reports-grid-cell-stack">
              <div className="reports-export-controls__actions">
                <Button
                  size="small"
                  appearance="secondary"
                  disabled={!hasIpc || showbackBusy !== null}
                  onClick={() => void handleExportShowback(statement, "csv")}
                >
                  Export CSV
                </Button>
                <Button
                  size="small"
                  appearance="secondary"
                  disabled={!hasIpc || showbackBusy !== null}
                  onClick={() => void handleExportShowback(statement, "xlsx")}
                >
                  Export XLSX
                </Button>
              </div>
              {showbackExportedFiles[statement.id] ? (
                <Text size={200}>
                  {showbackExportedFiles[statement.id].csv ??
                    showbackExportedFiles[statement.id].xlsx ??
                    ""}
                </Text>
              ) : null}
            </div>
          );
        }
      }
    ],
    [hasIpc, reportCurrency, showbackBusy, showbackExportedFiles]
  );

  function onUnmatchedGridReady(event: GridReadyEvent<UnmatchedActualItem>): void {
    setUnmatchedGridApi(event.api);
  }

  function onShowbackGridReady(event: GridReadyEvent<ShowbackStatement>): void {
    setShowbackGridApi(event.api);
  }

  async function loadWorkspaceData(
    preset: ReportPreset,
    scenarioId: string,
    options: { silent?: boolean } = {}
  ): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const next = (await queryReport({
        query: preset.query,
        scenarioId,
        filters: {
          dateFrom,
          dateTo,
          tag: tagFilter
        }
      })) as DashboardDataset;
      setDataset(next);
      if (!options.silent) {
        notify({ tone: "success", message: "Report dataset refreshed." });
      }
    } catch (nextError) {
      const detail = nextError instanceof Error ? nextError.message : String(nextError);
      const message = `Failed to load report dataset: ${detail}`;
      setError(message);
      setDataset(null);
      notify({ tone: "error", message });
    } finally {
      setLoading(false);
    }
  }

  async function loadOperationalData(scenarioId: string): Promise<void> {
    if (!hasIpc) {
      return;
    }
    try {
      const [unmatched, unmatchedSummaryResult, showbackSummary, qualitySummary] =
        await Promise.all([
          listUnmatchedActuals({ scenarioId }),
          queryReport({ query: "actuals.unmatched.summary", scenarioId }),
          queryReport({ query: "showback.summary", scenarioId }),
          queryReport({ query: "dataQuality.summary", scenarioId })
        ]);
      const parsedUnmatchedSummary = unmatchedSummaryResult as Partial<UnmatchedSummary>;
      const parsedShowbackSummary = showbackSummary as {
        statements?: ShowbackStatement[];
      };
      const parsedQualitySummary = qualitySummary as Partial<DataQualitySummary>;
      setUnmatchedItems(unmatched.items);
      setUnmatchedSummary({
        scenarioId: parsedUnmatchedSummary.scenarioId ?? scenarioId,
        unmatchedCount: parsedUnmatchedSummary.unmatchedCount ?? unmatched.total,
        unmatchedAmountMinor: parsedUnmatchedSummary.unmatchedAmountMinor ?? 0,
        drivers: parsedUnmatchedSummary.drivers ?? []
      });
      setShowbackStatements(parsedShowbackSummary.statements ?? []);
      setDataQualitySummary({
        scenarioId: parsedQualitySummary.scenarioId ?? scenarioId,
        expenseCount: parsedQualitySummary.expenseCount ?? 0,
        missingCostCenterCount: parsedQualitySummary.missingCostCenterCount ?? 0,
        missingGlAccountCount: parsedQualitySummary.missingGlAccountCount ?? 0,
        missingCapexOpexCount: parsedQualitySummary.missingCapexOpexCount ?? 0,
        missingRequiredTagCount: parsedQualitySummary.missingRequiredTagCount ?? 0
      });
    } catch (nextError) {
      const detail = nextError instanceof Error ? nextError.message : String(nextError);
      notify({ tone: "warning", message: `Operational data refresh failed: ${detail}` });
    }
  }

  useEffect(() => {
    if (!selectedPreset) {
      return;
    }
    void loadWorkspaceData(selectedPreset, selectedScenarioId, { silent: true });
  }, [dateFrom, dateTo, notify, selectedPreset, selectedScenarioId, tagFilter]);

  useEffect(() => {
    void loadOperationalData(selectedScenarioId);
  }, [hasIpc, selectedScenarioId]);

  function openPreset(preset: ReportPreset): void {
    setSelectedPresetId(preset.id);
    setVisualizations(preset.visualizations);
    notify({
      tone: "info",
      message: `Opened report preset: ${preset.title}.`
    });
  }

  function saveCurrentPreset(): void {
    const trimmed = savePresetName.trim();
    if (!trimmed || !selectedPreset) {
      notify({ tone: "warning", message: "Enter a preset name before saving." });
      return;
    }
    const id = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const saved = saveReportPreset(
      {
        id,
        title: trimmed,
        description: `Saved from ${selectedPreset.title}`,
        query: selectedPreset.query,
        visualizations
      },
      window.localStorage
    );
    setSavedPresets(saved);
    notify({
      tone: "success",
      message: `Saved report preset: ${trimmed}.`
    });
  }

  async function browseExportDestination(): Promise<void> {
    const picked = await pickDirectoryPath({
      title: "Choose export destination",
      defaultPath: destinationPath.trim() || undefined
    });
    if (!picked) {
      return;
    }
    setDestinationPath(picked);
    setDestinationConfirmed(true);
    setExportError(null);
    notify({
      tone: "success",
      message: `Export destination confirmed: ${picked}.`
    });
  }

  async function browseShowbackOutputDirectory(): Promise<void> {
    const picked = await pickDirectoryPath({
      title: "Choose showback output directory",
      defaultPath: showbackOutputDir.trim() || undefined
    });
    if (!picked) {
      return;
    }
    setShowbackOutputDir(picked);
  }

  async function queueExportJob(): Promise<void> {
    if (!selectedPreset) {
      return;
    }
    if (!destinationConfirmed) {
      const message = "Confirm destination path before queueing export.";
      setExportError(message);
      notify({ tone: "warning", message });
      return;
    }
    setExportError(null);
    const jobId = `job-${crypto.randomUUID()}`;
    const job: ExportJob = {
      id: jobId,
      format: exportFormat,
      destination: destinationPath.trim() || "(system default)",
      status: "running",
      outputPath: null,
      error: null
    };
    setExportJobs((current) => [job, ...current]);
    try {
      const result = await exportReport({
        scenarioId: selectedScenarioId,
        formats: [exportFormat],
        reportType: selectedPreset.query,
        outputDir: destinationPath.trim() || undefined,
        filters: {
          dateFrom,
          dateTo,
          tag: tagFilter
        }
      });
      const outputPath = result.files[exportFormat] ?? null;
      setExportJobs((current) =>
        current.map((entry) =>
          entry.id === jobId
            ? { ...entry, status: "succeeded", outputPath }
            : entry
        )
      );
      notify({
        tone: "success",
        message: `Export job ${jobId} completed (${exportFormat.toUpperCase()}).`
      });
    } catch (nextError) {
      const detail = nextError instanceof Error ? nextError.message : String(nextError);
      setExportJobs((current) =>
        current.map((entry) =>
          entry.id === jobId
            ? { ...entry, status: "failed", error: detail }
            : entry
        )
      );
      notify({
        tone: "error",
        message: `Export job ${jobId} failed: ${detail}`
      });
    }
  }

  async function loadReportPreview(): Promise<void> {
    if (!selectedPreset) {
      return;
    }

    setPreviewVisible(true);
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const preview = await previewReport({
        scenarioId: selectedScenarioId,
        reportType: selectedPreset.query,
        filters: {
          dateFrom,
          dateTo,
          tag: tagFilter
        }
      });
      setPreviewHtml(preview.html);
      notify({ tone: "success", message: "Report preview refreshed." });
    } catch (nextError) {
      const detail = nextError instanceof Error ? nextError.message : String(nextError);
      setPreviewError(detail);
      setPreviewHtml(null);
      notify({ tone: "error", message: `Failed to generate preview: ${detail}` });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function resolveUnmatchedActual(
    item: UnmatchedActualItem,
    disposition: "matched" | "rejected" | "ignored" | "create_expense"
  ): Promise<void> {
    setUnmatchedBusyTxn(item.id);
    try {
      if (disposition === "create_expense") {
        await createExpenseFromUnmatchedActual({
          transactionId: item.id,
          scenarioId: selectedScenarioId,
          reviewer: "single-it-user",
          name: item.description ?? `Imported actual ${item.id.slice(0, 8)}`,
          status: "planned",
          expenseType: "recurring",
          driverTag: unmatchedDriverByTxn[item.id]
        });
      } else {
        await reviewUnmatchedActual({
          transactionId: item.id,
          scenarioId: selectedScenarioId,
          disposition,
          matchedOccurrenceId:
            disposition === "matched" ? unmatchedSelectionByTxn[item.id] : undefined,
          reviewer: "single-it-user",
          driverTag: unmatchedDriverByTxn[item.id],
          comment: unmatchedCommentByTxn[item.id]
        });
      }
      notify({
        tone: "success",
        message: `Unmatched transaction ${item.id.slice(0, 8)} updated (${disposition}).`
      });
      await loadOperationalData(selectedScenarioId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      notify({ tone: "error", message: `Unmatched action failed: ${detail}` });
    } finally {
      setUnmatchedBusyTxn(null);
    }
  }

  async function handleGenerateShowback(): Promise<void> {
    setShowbackBusy("generate");
    try {
      await generateShowbackStatement({
        scenarioId: selectedScenarioId,
        periodStart: showbackPeriodStart,
        periodEnd: showbackPeriodEnd,
        groupBy: showbackGroupBy,
        generatedBy: "single-it-user"
      });
      notify({ tone: "success", message: "Showback statement generated." });
      await loadOperationalData(selectedScenarioId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      notify({ tone: "error", message: `Showback generation failed: ${detail}` });
    } finally {
      setShowbackBusy(null);
    }
  }

  async function handleExportShowback(
    statement: ShowbackStatement,
    format: "csv" | "xlsx"
  ): Promise<void> {
    setShowbackBusy("export");
    try {
      const exported = await exportShowbackStatement({
        statementId: statement.id,
        format,
        outputDir: showbackOutputDir.trim() || undefined
      });
      setShowbackExportedFiles((current) => ({
        ...current,
        [statement.id]: exported.files
      }));
      notify({
        tone: "success",
        message: `Showback exported (${format.toUpperCase()}).`
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      notify({ tone: "error", message: `Showback export failed: ${detail}` });
    } finally {
      setShowbackBusy(null);
    }
  }

  function openHelpTopic(
    topic: string,
    anchor?: string,
    q?: string,
    context?: string
  ): void {
    navigate(
      buildHelpHashPath({
        topic,
        anchor,
        q,
        context
      })
    );
  }

  function jumpToSection(section: "export" | "narrative"): void {
    const target = section === "export" ? exportSectionRef.current : narrativeSectionRef.current;
    if (!target) {
      notify({
        tone: "warning",
        message:
          section === "narrative"
            ? "Narrative section is not visible with current filters/toggles."
            : "Export section is not currently available."
      });
      return;
    }
    target.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  return (
    <section className="reports-page">
      <PageHeader
        title="Reports Workspace"
        subtitle={`Report gallery and configurable workspace. Active scenario: ${
          selectedScenario?.name ?? selectedScenarioId
        }.`}
        actions={(
          <div className="reports-export-controls__actions">
            <Button
              appearance="secondary"
              size="small"
              type="button"
              onClick={() =>
                openHelpTopic(
                  "reports-workspace",
                  "unmatched-actuals-review",
                  "reconciliation",
                  "reports:workspace"
                )
              }
            >
              Reports Help
            </Button>
            <Button
              appearance="secondary"
              size="small"
              type="button"
              onClick={() =>
                openHelpTopic("import-wizard", "commit-step", "import commit", "reports:import")
              }
            >
              Import/Match Help
            </Button>
            <Button
              appearance="secondary"
              size="small"
              type="button"
              onClick={() => jumpToSection("export")}
            >
              Jump to Export
            </Button>
            <Button
              appearance="secondary"
              size="small"
              type="button"
              onClick={() => jumpToSection("narrative")}
            >
              Jump to Narrative
            </Button>
          </div>
        )}
      />

      <Card data-testid="reports-scenario-context">
        <Text weight="semibold">Scenario context</Text>
        <Text>{selectedScenario?.name ?? selectedScenarioId}</Text>
      </Card>

      <Card>
        <Title3>Report Gallery</Title3>
        <div className="reports-gallery">
          {presets.map((preset) => (
            <article
              key={preset.id}
              className={
                preset.id === selectedPresetId
                  ? "reports-gallery__card reports-gallery__card--active"
                  : "reports-gallery__card"
              }
            >
              <Text weight="semibold">{preset.title}</Text>
              <Text>{preset.description}</Text>
              <Button
                size="small"
                appearance="secondary"
                onClick={() => openPreset(preset)}
              >
                {`Open ${preset.title}`}
              </Button>
            </article>
          ))}
        </div>
      </Card>

      <Card>
        <Title3>Workspace Filters</Title3>
        <div className="reports-filters">
          <Input
            aria-label="Filter start date"
            type="date"
            value={dateFrom}
            onChange={(_event, data) => setDateFrom(data.value)}
          />
          <Input
            aria-label="Filter end date"
            type="date"
            value={dateTo}
            onChange={(_event, data) => setDateTo(data.value)}
          />
          <Select
            aria-label="Filter tag"
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
          >
            <option value="all">All Tags</option>
            <option value="engineering">Engineering</option>
            <option value="security">Security</option>
            <option value="finance">Finance</option>
          </Select>
        </div>
        <div className="reports-visualizations">
          <Checkbox
            label="Show Table Block"
            checked={visualizations.table}
            onChange={(_event, data) =>
              setVisualizations((current) => ({
                ...current,
                table: data.checked === true
              }))
            }
          />
          <Checkbox
            label="Show Chart Block"
            checked={visualizations.chart}
            onChange={(_event, data) =>
              setVisualizations((current) => ({
                ...current,
                chart: data.checked === true
              }))
            }
          />
          <Checkbox
            label="Show Gauge Block"
            checked={visualizations.gauge}
            onChange={(_event, data) =>
              setVisualizations((current) => ({
                ...current,
                gauge: data.checked === true
              }))
            }
          />
          <Checkbox
            label="Show Narrative Block"
            checked={visualizations.narrative}
            onChange={(_event, data) =>
              setVisualizations((current) => ({
                ...current,
                narrative: data.checked === true
              }))
            }
          />
        </div>
      </Card>

      <section ref={exportSectionRef} data-testid="reports-export-section">
        <Card>
          <Title3>Export Orchestration</Title3>
          <div className="reports-export-controls">
            <section className="reports-export-controls__step">
              <Text className="reports-export-controls__label" weight="semibold">
                1. Choose format
              </Text>
              <Select
                aria-label="Export format"
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value as ReportFormat)}
              >
                {EXPORT_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {format.toUpperCase()}
                  </option>
                ))}
              </Select>
            </section>
            <section className="reports-export-controls__step">
              <Text className="reports-export-controls__label" weight="semibold">
                2. Confirm destination
              </Text>
              <Input
                aria-label="Export destination"
                value={destinationPath}
                onChange={(_event, data) => {
                  setDestinationPath(data.value);
                  setDestinationConfirmed(false);
                }}
                placeholder="Leave blank to use system default"
              />
              <Button
                appearance="secondary"
                disabled={!hasIpc}
                onClick={() => void browseExportDestination()}
              >
                Browse…
              </Button>
              <Button
                appearance="secondary"
                onClick={() => {
                  setExportError(null);
                  setDestinationConfirmed(true);
                  notify({
                    tone: "success",
                    message: destinationPath.trim()
                      ? `Export destination confirmed: ${destinationPath.trim()}.`
                      : "Export destination confirmed: using system default."
                  });
                }}
              >
                Confirm Destination
              </Button>
            </section>
            <section className="reports-export-controls__step">
              <Text className="reports-export-controls__label" weight="semibold">
                3. Preview and queue
              </Text>
              <div className="reports-export-controls__actions">
                <Button appearance="secondary" onClick={() => void loadReportPreview()}>
                  Preview Report
                </Button>
                <Button appearance="primary" onClick={() => void queueExportJob()}>
                  Queue Export
                </Button>
              </div>
            </section>
          </div>
        </Card>
      </section>

      {previewVisible ? (
        <Card data-testid="reports-export-preview">
          <div className="reports-preview__header">
            <Title3>Export Preview</Title3>
            <Button
              appearance="subtle"
              onClick={() => {
                setPreviewVisible(false);
                setPreviewError(null);
                setPreviewHtml(null);
              }}
            >
              Close Preview
            </Button>
          </div>
          {previewLoading ? (
            <Text>Generating preview...</Text>
          ) : previewError ? (
            <InlineError message={previewError} />
          ) : (
            <iframe
              title="Report export preview"
              className="reports-preview__frame"
              sandbox=""
              srcDoc={previewHtml ?? ""}
            />
          )}
        </Card>
      ) : null}

      <Card>
        <Title3>Save Report Preset</Title3>
        <div className="reports-save-preset">
          <Input
            aria-label="Save preset name"
            value={savePresetName}
            onChange={(_event, data) => setSavePresetName(data.value)}
            placeholder="My saved preset"
          />
          <Button appearance="secondary" onClick={saveCurrentPreset}>
            Save Preset
          </Button>
        </div>
      </Card>

      {exportError ? <InlineError message={exportError} /> : null}

      <Card data-testid="reports-export-metadata">
        <Text weight="semibold">{`Export metadata: scenario ${selectedScenarioId}`}</Text>
        {exportJobs.length === 0 ? (
          <Text>No export jobs queued.</Text>
        ) : (
          <Table aria-label="Export jobs table">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Format</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Destination</TableHeaderCell>
                <TableHeaderCell>Output</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exportJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>{job.format.toUpperCase()}</TableCell>
                  <TableCell>{job.status}</TableCell>
                  <TableCell>{job.destination}</TableCell>
                  <TableCell>{job.outputPath ?? job.error ?? "Pending..."}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card>
        <Title3>Data Quality Guardrails</Title3>
        {!dataQualitySummary ? (
          <Text>No data quality summary loaded.</Text>
        ) : (
          <div>
            <Text>{`Expense lines: ${dataQualitySummary.expenseCount}`}</Text>
            <Text>{`Missing Cost Center: ${dataQualitySummary.missingCostCenterCount}`}</Text>
            <Text>{`Missing GL Account: ${dataQualitySummary.missingGlAccountCount}`}</Text>
            <Text>{`Missing CapEx/OpEx: ${dataQualitySummary.missingCapexOpexCount}`}</Text>
            <Text>{`Missing required tags: ${dataQualitySummary.missingRequiredTagCount}`}</Text>
            {dataQualitySummary.missingCostCenterCount > 0 ||
            dataQualitySummary.missingGlAccountCount > 0 ||
            dataQualitySummary.missingCapexOpexCount > 0 ||
            dataQualitySummary.missingRequiredTagCount > 0 ? (
              <InlineError message="Data quality warnings detected. Fix metadata gaps before downstream exports." />
            ) : (
              <Text>All quality checks are passing for this scenario.</Text>
            )}
          </div>
        )}
      </Card>

      <Card data-testid="reports-definitions-card">
        <Title3>Field & Status Definitions</Title3>
        <ul className="reports-narrative">
          <li>
            <Text>
              <strong>Suggested match</strong>: candidate occurrence for reconciliation.
            </Text>
          </li>
          <li>
            <Text>
              <strong>Driver</strong>: root-cause tag (`timing`, `price`, `scope`) for unmatched variance.
            </Text>
          </li>
          <li>
            <Text>
              <strong>Match / Reject / Ignore / Create expense</strong>: final disposition of unmatched transactions.
            </Text>
          </li>
        </ul>
        <div className="reports-export-controls__actions">
          <Button
            appearance="secondary"
            size="small"
            type="button"
            onClick={() =>
              openHelpTopic(
                "reports-workspace",
                "glossary-reconciliation-statuses",
                "reconciliation statuses",
                "reports:definitions"
              )
            }
          >
            Open Full Definitions
          </Button>
        </div>
      </Card>

      <Card>
        <Title3>Unmatched Actuals Review</Title3>
        {!hasIpc ? <Text>Desktop IPC unavailable. Operational queue actions are disabled.</Text> : null}
        {!unmatchedSummary ? (
          <Text>No unmatched summary loaded.</Text>
        ) : (
          <>
            <Text>{`Unmatched count: ${unmatchedSummary.unmatchedCount}`}</Text>
            <Text>{`Unmatched amount: ${formatCurrencyMinor(
              unmatchedSummary.unmatchedAmountMinor,
              reportCurrency
            )}`}</Text>
            <Text>{`Driver mix: ${
              unmatchedSummary.drivers.length > 0
                ? unmatchedSummary.drivers
                    .map((entry) => `${entry.driverTag} (${entry.count})`)
                    .join(", ")
                : "none"
            }`}</Text>
          </>
        )}
        {unmatchedItems.length === 0 ? (
          <Text>No unmatched transactions in queue.</Text>
        ) : (
          useAgGrid ? (
            <div className="reports-grid-wrapper">
              <div className="reports-grid-actions">
                <Button
                  size="small"
                  appearance="secondary"
                  disabled={unmatchedGridApi === null}
                  onClick={() =>
                    unmatchedGridApi?.exportDataAsCsv({
                      fileName: `unmatched-actuals-${selectedScenarioId}.csv`
                    })
                  }
                >
                  Export queue CSV
                </Button>
              </div>
              <div
                className="ag-theme-quartz reports-grid reports-grid--tall"
                role="table"
                aria-label="Unmatched actuals table"
              >
                <AgGridReact<UnmatchedActualItem>
                  rowData={unmatchedItems}
                  columnDefs={unmatchedGridColumns}
                  defaultColDef={{
                    sortable: true,
                    filter: true,
                    resizable: true
                  }}
                  onGridReady={onUnmatchedGridReady}
                  getRowId={(params) => params.data.id}
                  rowHeight={56}
                />
              </div>
            </div>
          ) : (
            <Table aria-label="Unmatched actuals table">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Date</TableHeaderCell>
                  <TableHeaderCell>Amount</TableHeaderCell>
                  <TableHeaderCell>Description</TableHeaderCell>
                  <TableHeaderCell>Suggested match</TableHeaderCell>
                  <TableHeaderCell>Driver</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmatchedItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.transactionDate}</TableCell>
                    <TableCell>
                      {formatCurrencyMinor(item.amountMinor, item.currency, reportCurrency)}
                    </TableCell>
                    <TableCell>{item.description ?? "No description"}</TableCell>
                    <TableCell>
                      <Select
                        aria-label={`Unmatched suggestion ${item.id}`}
                        value={unmatchedSelectionByTxn[item.id] ?? ""}
                        onChange={(event) =>
                          setUnmatchedSelectionByTxn((current) => ({
                            ...current,
                            [item.id]: event.target.value
                          }))
                        }
                      >
                        <option value="">No match selected</option>
                        {item.suggestions.map((suggestion) => (
                          <option key={suggestion.occurrenceId} value={suggestion.occurrenceId}>
                            {`${suggestion.occurrenceDate} | ${(suggestion.amountMinor / 100).toFixed(2)} ${suggestion.currency}`}
                          </option>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        aria-label={`Unmatched driver ${item.id}`}
                        value={unmatchedDriverByTxn[item.id] ?? ""}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setUnmatchedDriverByTxn((current) => {
                            if (
                              nextValue !== "timing" &&
                              nextValue !== "price" &&
                              nextValue !== "scope"
                            ) {
                              const next = { ...current };
                              delete next[item.id];
                              return next;
                            }
                            return {
                              ...current,
                              [item.id]: nextValue
                            };
                          });
                        }}
                      >
                        <option value="">None</option>
                        <option value="timing">{toTitleCaseLabel("timing")}</option>
                        <option value="price">{toTitleCaseLabel("price")}</option>
                        <option value="scope">{toTitleCaseLabel("scope")}</option>
                      </Select>
                      <Input
                        aria-label={`Unmatched comment ${item.id}`}
                        placeholder="Optional comment"
                        value={unmatchedCommentByTxn[item.id] ?? ""}
                        onChange={(_event, data) =>
                          setUnmatchedCommentByTxn((current) => ({
                            ...current,
                            [item.id]: data.value
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="reports-export-controls__actions">
                        <Button
                          size="small"
                          appearance="secondary"
                          disabled={
                            !hasIpc ||
                            unmatchedBusyTxn !== null ||
                            !Boolean(unmatchedSelectionByTxn[item.id])
                          }
                          onClick={() => void resolveUnmatchedActual(item, "matched")}
                        >
                          Match
                        </Button>
                        <Button
                          size="small"
                          appearance="secondary"
                          disabled={!hasIpc || unmatchedBusyTxn !== null}
                          onClick={() => void resolveUnmatchedActual(item, "rejected")}
                        >
                          Reject
                        </Button>
                        <Button
                          size="small"
                          appearance="secondary"
                          disabled={!hasIpc || unmatchedBusyTxn !== null}
                          onClick={() => void resolveUnmatchedActual(item, "ignored")}
                        >
                          Ignore
                        </Button>
                        <Button
                          size="small"
                          appearance="primary"
                          disabled={!hasIpc || unmatchedBusyTxn !== null}
                          onClick={() => void resolveUnmatchedActual(item, "create_expense")}
                        >
                          Create Expense
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        )}
      </Card>

      <Card>
        <Title3>Showback Statements</Title3>
        {!hasIpc ? <Text>Desktop IPC unavailable. Showback generation/export is disabled.</Text> : null}
        <div className="reports-filters">
          <Input
            aria-label="Showback period start"
            type="date"
            value={showbackPeriodStart}
            onChange={(_event, data) => setShowbackPeriodStart(data.value)}
          />
          <Input
            aria-label="Showback period end"
            type="date"
            value={showbackPeriodEnd}
            onChange={(_event, data) => setShowbackPeriodEnd(data.value)}
          />
          <Select
            aria-label="Showback group by"
            value={showbackGroupBy}
            onChange={(event) =>
              setShowbackGroupBy(event.target.value as "cost_center" | "team")
            }
          >
            <option value="cost_center">{toTitleCaseLabel("cost_center")}</option>
            <option value="team">{toTitleCaseLabel("team")}</option>
          </Select>
          <Input
            aria-label="Showback output directory"
            value={showbackOutputDir}
            onChange={(_event, data) => setShowbackOutputDir(data.value)}
            placeholder="Leave blank to use system default"
          />
          <Button
            appearance="secondary"
            disabled={!hasIpc || showbackBusy !== null}
            onClick={() => void browseShowbackOutputDirectory()}
          >
            Browse…
          </Button>
          <Button
            appearance="primary"
            disabled={!hasIpc || showbackBusy !== null}
            onClick={() => void handleGenerateShowback()}
          >
            {showbackBusy === "generate" ? "Generating..." : "Generate Statement"}
          </Button>
        </div>
        {showbackStatements.length === 0 ? (
          <Text>No showback statements generated yet.</Text>
        ) : (
          useAgGrid ? (
            <div className="reports-grid-wrapper">
              <div className="reports-grid-actions">
                <Button
                  size="small"
                  appearance="secondary"
                  disabled={showbackGridApi === null}
                  onClick={() =>
                    showbackGridApi?.exportDataAsCsv({
                      fileName: `showback-${selectedScenarioId}.csv`
                    })
                  }
                >
                  Export statements CSV
                </Button>
              </div>
              <div
                className="ag-theme-quartz reports-grid"
                role="table"
                aria-label="Showback statements table"
              >
                <AgGridReact<ShowbackStatement>
                  rowData={showbackStatements}
                  columnDefs={showbackGridColumns}
                  defaultColDef={{
                    sortable: true,
                    filter: true,
                    resizable: true
                  }}
                  getRowId={(params) => params.data.id}
                  onGridReady={onShowbackGridReady}
                  rowHeight={56}
                />
              </div>
            </div>
          ) : (
            <Table aria-label="Showback statements table">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Period</TableHeaderCell>
                  <TableHeaderCell>Group By</TableHeaderCell>
                  <TableHeaderCell>Total</TableHeaderCell>
                  <TableHeaderCell>Lines</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {showbackStatements.map((statement) => (
                  <TableRow key={statement.id}>
                    <TableCell>{`${statement.periodStart} to ${statement.periodEnd}`}</TableCell>
                    <TableCell>{statement.groupBy}</TableCell>
                    <TableCell>
                      {formatCurrencyMinor(
                        statement.totalMinor,
                        resolveDisplayCurrency(statement.currency, reportCurrency),
                        reportCurrency
                      )}
                    </TableCell>
                    <TableCell>{statement.lineCount ?? statement.lines?.length ?? 0}</TableCell>
                    <TableCell>
                      <div className="reports-export-controls__actions">
                        <Button
                          size="small"
                          appearance="secondary"
                          disabled={!hasIpc || showbackBusy !== null}
                          onClick={() => void handleExportShowback(statement, "csv")}
                        >
                          Export CSV
                        </Button>
                        <Button
                          size="small"
                          appearance="secondary"
                          disabled={!hasIpc || showbackBusy !== null}
                          onClick={() => void handleExportShowback(statement, "xlsx")}
                        >
                          Export XLSX
                        </Button>
                      </div>
                      {showbackExportedFiles[statement.id] ? (
                        <Text>
                          {showbackExportedFiles[statement.id].csv ??
                            showbackExportedFiles[statement.id].xlsx ??
                            ""}
                        </Text>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        )}
      </Card>

      {loading ? (
        <LoadingState label="Loading report dataset..." />
      ) : error ? (
        <InlineError
          message={error}
          action={
            selectedPreset ? (
              <Button
                appearance="secondary"
                onClick={() => void loadWorkspaceData(selectedPreset, selectedScenarioId)}
                size="small"
              >
                Retry
              </Button>
            ) : undefined
          }
        />
      ) : !dataset ? (
        <EmptyState
          title="No report dataset available"
          description="Adjust filters or choose another gallery report."
        />
      ) : (
        <ErrorBoundary label="Report widgets failed">
          <section className="reports-blocks">
            {visualizations.table ? (
              <Card>
                <Title3>Table Block</Title3>
                <Table aria-label="Report spend table">
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell>Month</TableHeaderCell>
                      <TableHeaderCell>Forecast</TableHeaderCell>
                      <TableHeaderCell>Actual</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataset.spendTrend.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell>{row.month}</TableCell>
                        <TableCell>{row.forecastMinor}</TableCell>
                        <TableCell>{row.actualMinor}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : null}
            {visualizations.chart ? (
              <Card>
                <Title3>Chart Block</Title3>
                <div className="reports-chart">
                  {dataset.renewals.map((row) => (
                    <div key={row.month} className="reports-chart__row">
                      <Text>{row.month}</Text>
                      <div className="reports-chart__bar-track">
                        <div
                          className="reports-chart__bar"
                          style={{ width: `${Math.max(row.count * 15, 5)}%` }}
                        />
                      </div>
                      <Text>{row.count}</Text>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
            {visualizations.gauge ? (
              <Card>
                <Title3>Gauge Block</Title3>
                <Text>{`Tag completeness ${(dataset.taggingCompleteness.completenessRatio * 100).toFixed(1)}%`}</Text>
                <Text>{`Replacement required ${dataset.replacementStatus.replacementRequiredOpen}`}</Text>
              </Card>
            ) : null}
            {visualizations.narrative ? (
              <section ref={narrativeSectionRef} data-testid="reports-narrative-section">
                <Card>
                  <Title3>Narrative Block</Title3>
                  <ul className="reports-narrative">
                    {dataset.narrativeBlocks.map((block) => (
                      <li key={block.id}>
                        <Text weight="semibold">{block.title}</Text>
                        <Text>{block.body}</Text>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            ) : null}
          </section>
        </ErrorBoundary>
      )}
    </section>
  );
}

