import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Spinner,
  Text,
  Title3
} from "@fluentui/react-components";

import type { DashboardDataset } from "../../reporting";
import { useScenarioContext } from "../scenarios/ScenarioContext";
import { exportReport, queryReport } from "../../lib/ipcClient";
import { EmptyState, InlineError, PageHeader } from "../../ui/primitives";
import {
  buildDashboardKpiMetrics,
  mapDashboardStaleState
} from "./dashboard-model";
import "./DashboardPage.css";

type ExportFormat = "html" | "pdf" | "excel" | "csv" | "png";
const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

const EXPORT_FORMAT_OPTIONS: Array<{ format: ExportFormat; label: string }> = [
  { format: "html", label: "Export HTML" },
  { format: "pdf", label: "Export PDF" },
  { format: "excel", label: "Export Excel" },
  { format: "csv", label: "Export CSV" },
  { format: "png", label: "Export PNG" }
];

function formatUsd(minor: number): string {
  return CURRENCY_FORMATTER.format(minor / 100);
}

function toPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function barWidth(value: number, max: number): string {
  if (max <= 0) {
    return "0%";
  }
  return `${Math.max((value / max) * 100, 2)}%`;
}

export function DashboardPage() {
  const { selectedScenarioId, selectedScenario } = useScenarioContext();
  const [dataset, setDataset] = useState<DashboardDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [rematerializing, setRematerializing] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportFiles, setExportFiles] = useState<
    Partial<Record<ExportFormat, string>>
  >({});

  const kpis = useMemo(
    () => (dataset ? buildDashboardKpiMetrics(dataset) : null),
    [dataset]
  );
  const staleState = useMemo(
    () => (dataset ? mapDashboardStaleState(dataset) : { isStale: false, message: null }),
    [dataset]
  );
  const maxSpendMinor = useMemo(() => {
    if (!dataset || dataset.spendTrend.length === 0) {
      return 0;
    }
    return Math.max(...dataset.spendTrend.map((row) => Math.max(row.forecastMinor, row.actualMinor)));
  }, [dataset]);
  const maxRenewalCount = useMemo(() => {
    if (!dataset || dataset.renewals.length === 0) {
      return 0;
    }
    return Math.max(...dataset.renewals.map((row) => row.count));
  }, [dataset]);
  const maxVarianceMinor = useMemo(() => {
    if (!dataset || dataset.variance.length === 0) {
      return 0;
    }
    return Math.max(...dataset.variance.map((row) => Math.abs(row.varianceMinor)));
  }, [dataset]);

  async function loadDashboard(
    scenarioId: string,
    rematerialize = false
  ): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const next = (await queryReport({
        query: "dashboard.summary",
        scenarioId
      })) as DashboardDataset;
      setDataset(next);
      setRefreshMessage(
        rematerialize
          ? "Re-materialize action requested and dashboard data refreshed."
          : "Dashboard data refreshed."
      );
    } catch (nextError) {
      const detail = nextError instanceof Error ? nextError.message : String(nextError);
      setError(`Failed to load dashboard: ${detail}`);
    } finally {
      setLoading(false);
      setRematerializing(false);
    }
  }

  useEffect(() => {
    void loadDashboard(selectedScenarioId);
  }, [selectedScenarioId]);

  async function handleRematerialize(): Promise<void> {
    setRematerializing(true);
    await loadDashboard(selectedScenarioId, true);
  }

  async function handleExport(format: ExportFormat): Promise<void> {
    setExportingFormat(format);
    setExportError(null);
    try {
      const result = await exportReport({
        scenarioId: selectedScenarioId,
        formats: [format]
      });
      setExportFiles(result.files);
    } catch (nextError) {
      const detail = nextError instanceof Error ? nextError.message : String(nextError);
      setExportError(`Export failed for ${format.toUpperCase()}: ${detail}`);
    } finally {
      setExportingFormat(null);
    }
  }

  if (loading && !dataset) {
    return (
      <section className="dashboard-page dashboard-page--loading" aria-live="polite">
        <Spinner label="Loading dashboard..." />
      </section>
    );
  }

  return (
    <section className="dashboard-page" aria-live="polite">
      <PageHeader
        title="Dashboard"
        subtitle={`Decision-ready view for forecast, actuals, renewals, and replacement readiness. Active scenario: ${
          selectedScenario?.name ?? selectedScenarioId
        }.`}
        actions={
          <div className="dashboard-page__actions">
            <Button
              appearance="secondary"
              onClick={() => void loadDashboard(selectedScenarioId)}
            >
              Refresh
            </Button>
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button appearance="primary" disabled={exportingFormat !== null}>
                  {exportingFormat ? `Exporting ${exportingFormat.toUpperCase()}...` : "Export"}
                </Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {EXPORT_FORMAT_OPTIONS.map((option) => (
                    <MenuItem
                      key={option.format}
                      disabled={exportingFormat !== null}
                      onClick={() => {
                        void handleExport(option.format);
                      }}
                    >
                      {option.label}
                    </MenuItem>
                  ))}
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        }
      />

      {staleState.isStale ? (
        <Card className="dashboard-page__stale-card" data-testid="stale-forecast-banner">
          <Text weight="semibold">Forecast freshness warning</Text>
          <Text>{staleState.message}</Text>
          <Button
            appearance="secondary"
            disabled={rematerializing}
            onClick={() => void handleRematerialize()}
          >
            {rematerializing ? "Re-materializing..." : "Re-materialize"}
          </Button>
        </Card>
      ) : null}

      {error ? <InlineError message={error} /> : null}
      <Text data-testid="dashboard-scenario-context">{`Scenario: ${
        selectedScenario?.name ?? selectedScenarioId
      }`}</Text>
      {refreshMessage ? <Text>{refreshMessage}</Text> : null}
      {exportError ? <InlineError message={exportError} /> : null}

      {Object.keys(exportFiles).length > 0 ? (
        <Card data-testid="export-result-card">
          <Text weight="semibold">Export completed</Text>
          <ul className="dashboard-page__export-list">
            {Object.entries(exportFiles).map(([format, filePath]) => (
              <li key={format}>
                <Text>
                  {format.toUpperCase()}: {filePath}
                </Text>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {!dataset || !kpis ? (
        <EmptyState
          title="No dashboard data available"
          description="Import or create records to populate dashboard insights."
        />
      ) : (
        <>
          <section className="dashboard-kpis">
            <Card className="dashboard-kpi-card">
              <Text>Forecast</Text>
              <Title3>{formatUsd(kpis.forecastMinor)}</Title3>
            </Card>
            <Card className="dashboard-kpi-card">
              <Text>Actual</Text>
              <Title3>{formatUsd(kpis.actualMinor)}</Title3>
            </Card>
            <Card className="dashboard-kpi-card">
              <Text>Variance</Text>
              <Title3>{formatUsd(kpis.varianceMinor)}</Title3>
              <Badge
                appearance="filled"
                color={kpis.varianceMinor > 0 ? "warning" : "success"}
              >
                {kpis.varianceMinor > 0 ? "Above Forecast" : "Within Forecast"}
              </Badge>
            </Card>
            <Card className="dashboard-kpi-card">
              <Text>Renewals (Upcoming)</Text>
              <Title3>{kpis.renewalCount}</Title3>
            </Card>
            <Card className="dashboard-kpi-card">
              <Text>Tagging Completeness</Text>
              <Title3>{toPercent(kpis.taggingCompletenessPct)}</Title3>
            </Card>
            <Card className="dashboard-kpi-card">
              <Text>Replacement Required</Text>
              <Title3>{kpis.replacementRequiredOpen}</Title3>
            </Card>
          </section>

          <section className="dashboard-grid">
            <Card className="dashboard-chart-card">
              <Title3>Spend Trend</Title3>
              <div className="dashboard-chart">
                {dataset.spendTrend.map((row) => (
                  <div className="dashboard-chart__row" key={row.month}>
                    <Text className="dashboard-chart__label">{row.month}</Text>
                    <div className="dashboard-chart__bar-group">
                      <div className="dashboard-chart__bar-track">
                        <div
                          className="dashboard-chart__bar dashboard-chart__bar--forecast"
                          style={{ width: barWidth(row.forecastMinor, maxSpendMinor) }}
                          title={`Forecast ${formatUsd(row.forecastMinor)}`}
                        />
                      </div>
                      <div className="dashboard-chart__bar-track">
                        <div
                          className="dashboard-chart__bar dashboard-chart__bar--actual"
                          style={{ width: barWidth(row.actualMinor, maxSpendMinor) }}
                          title={`Actual ${formatUsd(row.actualMinor)}`}
                        />
                      </div>
                    </div>
                    <Text className="dashboard-chart__value">{formatUsd(row.actualMinor)}</Text>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="dashboard-chart-card">
              <Title3>Variance</Title3>
              <div className="dashboard-chart">
                {dataset.variance.map((row) => (
                  <div className="dashboard-chart__row" key={row.month}>
                    <Text className="dashboard-chart__label">{row.month}</Text>
                    <div className="dashboard-chart__bar-track">
                      <div
                        className={
                          row.varianceMinor >= 0
                            ? "dashboard-chart__bar dashboard-chart__bar--variance-up"
                            : "dashboard-chart__bar dashboard-chart__bar--variance-down"
                        }
                        style={{
                          width: barWidth(Math.abs(row.varianceMinor), maxVarianceMinor)
                        }}
                        title={`Variance ${formatUsd(row.varianceMinor)}`}
                      />
                    </div>
                    <Text className="dashboard-chart__value">{formatUsd(row.varianceMinor)}</Text>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="dashboard-chart-card">
              <Title3>Renewals Timeline</Title3>
              <div className="dashboard-chart">
                {dataset.renewals.length === 0 ? (
                  <Text>No renewals scheduled.</Text>
                ) : (
                  dataset.renewals.map((row) => (
                    <div className="dashboard-chart__row" key={row.month}>
                      <Text className="dashboard-chart__label">{row.month}</Text>
                      <div className="dashboard-chart__bar-track">
                        <div
                          className="dashboard-chart__bar dashboard-chart__bar--renewal"
                          style={{ width: barWidth(row.count, maxRenewalCount) }}
                          title={`Renewals ${row.count}`}
                        />
                      </div>
                      <Text className="dashboard-chart__value">{row.count}</Text>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </section>

          <section className="dashboard-narratives">
            {dataset.narrativeBlocks.map((block) => (
              <Card key={block.id}>
                <Text weight="semibold">{block.title}</Text>
                <Text>{block.body}</Text>
              </Card>
            ))}
          </section>
        </>
      )}
    </section>
  );
}
