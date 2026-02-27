import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Select,
  Text,
  Title3
} from "@fluentui/react-components";

import type { DashboardDataset } from "../../reporting";
import { exportReport, queryReport } from "../../lib/ipcClient";
import { EmptyState, InlineError, PageHeader } from "../../ui/primitives";
import { useScenarioContext } from "../scenarios/ScenarioContext";
import "./ReportsPage.css";

type ReportFormat = "html" | "pdf" | "excel" | "csv" | "png";
type ReportType = "dashboard.summary" | "renewals.timeline" | "variance.monthly";

const REPORT_TYPES: Array<{ value: ReportType; label: string }> = [
  { value: "dashboard.summary", label: "Dashboard Summary" },
  { value: "renewals.timeline", label: "Renewals Timeline" },
  { value: "variance.monthly", label: "Monthly Variance" }
];

const EXPORT_FORMATS: Array<{ value: ReportFormat; label: string }> = [
  { value: "html", label: "Export HTML" },
  { value: "pdf", label: "Export PDF" },
  { value: "excel", label: "Export Excel" },
  { value: "csv", label: "Export CSV" },
  { value: "png", label: "Export PNG" }
];

export function ReportsPage() {
  const { selectedScenarioId, selectedScenario } = useScenarioContext();
  const [reportType, setReportType] = useState<ReportType>("dashboard.summary");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataset, setDataset] = useState<DashboardDataset | null>(null);
  const [exporting, setExporting] = useState<ReportFormat | null>(null);
  const [exportFiles, setExportFiles] = useState<
    Partial<Record<ReportFormat, string>>
  >({});
  const [exportError, setExportError] = useState<string | null>(null);

  async function loadReport(nextType: ReportType, scenarioId: string): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const next = (await queryReport({
        query: nextType,
        scenarioId
      })) as DashboardDataset;
      setDataset(next);
    } catch (nextError) {
      const detail = nextError instanceof Error ? nextError.message : String(nextError);
      setError(`Failed to load report dataset: ${detail}`);
      setDataset(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport(reportType, selectedScenarioId);
  }, [reportType, selectedScenarioId]);

  async function handleExport(format: ReportFormat): Promise<void> {
    setExporting(format);
    setExportError(null);
    try {
      const result = await exportReport({
        scenarioId: selectedScenarioId,
        formats: [format],
        reportType
      });
      setExportFiles(result.files);
    } catch (nextError) {
      const detail = nextError instanceof Error ? nextError.message : String(nextError);
      setExportError(`Export failed: ${detail}`);
    } finally {
      setExporting(null);
    }
  }

  return (
    <section className="reports-page">
      <PageHeader
        title="Reports Workspace"
        subtitle={`Gallery and workspace controls with active scenario context: ${
          selectedScenario?.name ?? selectedScenarioId
        }.`}
        actions={
          <div className="reports-page__actions">
            <Button
              appearance="secondary"
              onClick={() => void loadReport(reportType, selectedScenarioId)}
              disabled={loading}
            >
              Refresh
            </Button>
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button appearance="primary" disabled={exporting !== null}>
                  {exporting ? `Exporting ${exporting.toUpperCase()}...` : "Export"}
                </Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {EXPORT_FORMATS.map((entry) => (
                    <MenuItem
                      key={entry.value}
                      disabled={exporting !== null}
                      onClick={() => {
                        void handleExport(entry.value);
                      }}
                    >
                      {entry.label}
                    </MenuItem>
                  ))}
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        }
      />

      <Card data-testid="reports-scenario-context">
        <Text weight="semibold">Scenario context</Text>
        <Text>{selectedScenario?.name ?? selectedScenarioId}</Text>
      </Card>

      <Card>
        <Title3>Report Type</Title3>
        <Select
          aria-label="Report type"
          value={reportType}
          onChange={(event) => setReportType(event.target.value as ReportType)}
        >
          {REPORT_TYPES.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </Select>
      </Card>

      {error ? <InlineError message={error} /> : null}
      {exportError ? <InlineError message={exportError} /> : null}

      {Object.keys(exportFiles).length > 0 ? (
        <Card data-testid="reports-export-metadata">
          <Text weight="semibold">{`Export metadata: scenario ${selectedScenarioId}`}</Text>
          <ul className="reports-page__export-list">
            {Object.entries(exportFiles).map(([format, path]) => (
              <li key={format}>
                <Text>{`${format.toUpperCase()}: ${path}`}</Text>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <Text>Loading report dataset...</Text>
        </Card>
      ) : !dataset ? (
        <EmptyState
          title="No report dataset available"
          description="Select another report type or refresh this scenario context."
        />
      ) : (
        <Card>
          <Title3>{`Dataset snapshot (${dataset.scenarioId})`}</Title3>
          <Text>{`Spend trend rows: ${dataset.spendTrend.length}`}</Text>
          <Text>{`Variance rows: ${dataset.variance.length}`}</Text>
          <Text>{`Renewal rows: ${dataset.renewals.length}`}</Text>
        </Card>
      )}
    </section>
  );
}

