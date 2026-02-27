import { useEffect, useMemo, useState } from "react";
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

import type { DashboardDataset } from "../../reporting";
import { exportReport, queryReport } from "../../lib/ipcClient";
import { useFeedback } from "../../ui/feedback";
import {
  EmptyState,
  ErrorBoundary,
  InlineError,
  LoadingState,
  PageHeader
} from "../../ui/primitives";
import { useScenarioContext } from "../scenarios/ScenarioContext";
import {
  DEFAULT_REPORT_PRESETS,
  loadSavedReportPresets,
  saveReportPreset,
  type ReportPreset
} from "./reports-config-model";
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

export function ReportsPage() {
  const { selectedScenarioId, selectedScenario } = useScenarioContext();
  const { notify } = useFeedback();
  const [savedPresets, setSavedPresets] = useState(() => loadSavedReportPresets());
  const [selectedPresetId, setSelectedPresetId] = useState(
    DEFAULT_REPORT_PRESETS[0]?.id ?? ""
  );
  const [dateFrom, setDateFrom] = useState("2026-01-01");
  const [dateTo, setDateTo] = useState("2026-12-31");
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
  const [destinationPath, setDestinationPath] = useState("C:\\exports");
  const [destinationConfirmed, setDestinationConfirmed] = useState(false);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);
  const [savePresetName, setSavePresetName] = useState("");

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

  useEffect(() => {
    if (!selectedPreset) {
      return;
    }
    void loadWorkspaceData(selectedPreset, selectedScenarioId, { silent: true });
  }, [dateFrom, dateTo, notify, selectedPreset, selectedScenarioId, tagFilter]);

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

  async function queueExportJob(): Promise<void> {
    if (!selectedPreset) {
      return;
    }
    if (!destinationConfirmed || !destinationPath.trim()) {
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
      destination: destinationPath,
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
        destinationPath: destinationPath.trim(),
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

  return (
    <section className="reports-page">
      <PageHeader
        title="Reports Workspace"
        subtitle={`Report gallery and configurable workspace. Active scenario: ${
          selectedScenario?.name ?? selectedScenarioId
        }.`}
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
            <option value="all">All tags</option>
            <option value="engineering">Engineering</option>
            <option value="security">Security</option>
            <option value="finance">Finance</option>
          </Select>
        </div>
        <div className="reports-visualizations">
          <Checkbox
            label="Show table block"
            checked={visualizations.table}
            onChange={(_event, data) =>
              setVisualizations((current) => ({
                ...current,
                table: data.checked === true
              }))
            }
          />
          <Checkbox
            label="Show chart block"
            checked={visualizations.chart}
            onChange={(_event, data) =>
              setVisualizations((current) => ({
                ...current,
                chart: data.checked === true
              }))
            }
          />
          <Checkbox
            label="Show gauge block"
            checked={visualizations.gauge}
            onChange={(_event, data) =>
              setVisualizations((current) => ({
                ...current,
                gauge: data.checked === true
              }))
            }
          />
          <Checkbox
            label="Show narrative block"
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

      <Card>
        <Title3>Export Orchestration</Title3>
        <div className="reports-export-controls">
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
          <Input
            aria-label="Export destination"
            value={destinationPath}
            onChange={(_event, data) => {
              setDestinationPath(data.value);
              setDestinationConfirmed(false);
            }}
            placeholder="C:\\exports"
          />
          <Button
            appearance="secondary"
            onClick={() => {
              if (!destinationPath.trim()) {
                const message = "Destination path is required.";
                setExportError(message);
                notify({ tone: "warning", message });
                return;
              }
              setExportError(null);
              setDestinationConfirmed(true);
              notify({
                tone: "success",
                message: `Export destination confirmed: ${destinationPath}.`
              });
            }}
          >
            Confirm destination
          </Button>
          <Button appearance="primary" onClick={() => void queueExportJob()}>
            Queue export
          </Button>
        </div>
      </Card>

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
            Save preset
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
            ) : null}
          </section>
        </ErrorBoundary>
      )}
    </section>
  );
}

