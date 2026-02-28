import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Select,
  Text,
  Title3
} from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";

import type { DashboardDataset } from "../../reporting";
import { useScenarioContext } from "../scenarios/ScenarioContext";
import { exportReport, queryReport } from "../../lib/ipcClient";
import { useFeedback } from "../../ui/feedback";
import {
  EmptyState,
  ErrorBoundary,
  InlineError,
  LoadingState,
  PageHeader
} from "../../ui/primitives";
import {
  DASHBOARD_CARD_DEFINITION_MAP,
  buildDashboardKpiMetrics,
  createDefaultDashboardLayout,
  DASHBOARD_RANGE_MONTHS,
  type DashboardCardId,
  type DashboardLayout,
  filterDashboardDatasetByRange,
  loadDashboardLayout,
  moveDashboardCard,
  updateDashboardCardVisibility,
  addDashboardLayoutSection,
  assignDashboardCardSection,
  saveDashboardLayout,
  type DashboardRange,
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

const DASHBOARD_RANGE_OPTIONS: Array<{ id: DashboardRange; label: string }> = [
  { id: "1m", label: "1m" },
  { id: "3m", label: "3m" },
  { id: "12m", label: "12m" },
  { id: "60m", label: "60m" }
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

function formatMonthWindow(months: number): string {
  return `${months} month${months === 1 ? "" : "s"}`;
}

type DashboardRenderContext = {
  dataset: DashboardDataset;
  visibleDataset: DashboardDataset;
  kpis: ReturnType<typeof buildDashboardKpiMetrics>;
  maxSpendMinor: number;
  maxRenewalCount: number;
  maxVarianceMinor: number;
  maxGrowthPct: number;
  maxReplacementStatusCount: number;
};

function getDashboardCardClassName(cardId: DashboardCardId): string {
  if (cardId.startsWith("kpi-")) {
    return "dashboard-kpi-card";
  }
  if (cardId.startsWith("chart-")) {
    return "dashboard-chart-card";
  }
  return "dashboard-insight-card";
}

function renderDashboardCard(cardId: DashboardCardId, context: DashboardRenderContext) {
  const {
    dataset,
    visibleDataset,
    kpis,
    maxSpendMinor,
    maxRenewalCount,
    maxVarianceMinor,
    maxGrowthPct,
    maxReplacementStatusCount
  } = context;

  if (cardId === "kpi-forecast") {
    return (
      <>
        <Text>Forecast</Text>
        <Title3>{formatUsd(kpis.forecastMinor)}</Title3>
      </>
    );
  }

  if (cardId === "kpi-actual") {
    return (
      <>
        <Text>Actual</Text>
        <Title3>{formatUsd(kpis.actualMinor)}</Title3>
      </>
    );
  }

  if (cardId === "kpi-variance") {
    return (
      <>
        <Text>Variance</Text>
        <Title3>{formatUsd(kpis.varianceMinor)}</Title3>
        <Badge
          appearance="filled"
          color={kpis.varianceMinor > 0 ? "warning" : "success"}
        >
          {kpis.varianceMinor > 0 ? "Above Forecast" : "Within Forecast"}
        </Badge>
      </>
    );
  }

  if (cardId === "kpi-renewals") {
    return (
      <>
        <Text>Renewals (Upcoming)</Text>
        <Title3>{kpis.renewalCount}</Title3>
      </>
    );
  }

  if (cardId === "kpi-tagging") {
    return (
      <>
        <Text>Tagging Completeness</Text>
        <Title3>{toPercent(kpis.taggingCompletenessPct)}</Title3>
      </>
    );
  }

  if (cardId === "kpi-replacement") {
    return (
      <>
        <Text>Replacement Required</Text>
        <Title3>{kpis.replacementRequiredOpen}</Title3>
      </>
    );
  }

  if (cardId === "chart-spend-trend") {
    return (
      <>
        <Title3>Spend Trend</Title3>
        <div className="dashboard-chart">
          {visibleDataset.spendTrend.map((row) => (
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
      </>
    );
  }

  if (cardId === "chart-variance") {
    return (
      <>
        <Title3>Variance</Title3>
        <div className="dashboard-chart">
          {visibleDataset.variance.map((row) => (
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
      </>
    );
  }

  if (cardId === "chart-renewals") {
    return (
      <>
        <Title3>Renewals Timeline</Title3>
        <div className="dashboard-chart">
          {visibleDataset.renewals.length === 0 ? (
            <Text>No renewals scheduled.</Text>
          ) : (
            visibleDataset.renewals.map((row) => (
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
      </>
    );
  }

  if (cardId === "chart-growth") {
    return (
      <>
        <Title3>Growth Trend</Title3>
        <div className="dashboard-chart">
          {visibleDataset.growth.length === 0 ? (
            <Text>No growth points available.</Text>
          ) : (
            visibleDataset.growth.map((row) => {
              const growthPct = row.growthPct ?? 0;
              const label = row.growthPct === null ? "N/A" : `${growthPct.toFixed(1)}%`;
              return (
                <div className="dashboard-chart__row" key={row.month}>
                  <Text className="dashboard-chart__label">{row.month}</Text>
                  <div className="dashboard-chart__bar-track">
                    <div
                      className={
                        growthPct >= 0
                          ? "dashboard-chart__bar dashboard-chart__bar--growth-up"
                          : "dashboard-chart__bar dashboard-chart__bar--growth-down"
                      }
                      style={{ width: barWidth(Math.abs(growthPct), maxGrowthPct) }}
                      title={`Growth ${label}`}
                    />
                  </div>
                  <Text className="dashboard-chart__value">{label}</Text>
                </div>
              );
            })
          )}
        </div>
      </>
    );
  }

  if (cardId === "chart-replacement-status") {
    return (
      <>
        <Title3>Replacement Status Breakdown</Title3>
        <div className="dashboard-chart">
          {dataset.replacementStatus.byStatus.length === 0 ? (
            <Text>No replacement status records.</Text>
          ) : (
            dataset.replacementStatus.byStatus.map((row) => (
              <div className="dashboard-chart__row" key={row.status}>
                <Text className="dashboard-chart__label">{row.status}</Text>
                <div className="dashboard-chart__bar-track">
                  <div
                    className="dashboard-chart__bar dashboard-chart__bar--replacement"
                    style={{ width: barWidth(row.count, maxReplacementStatusCount) }}
                    title={`${row.status}: ${row.count}`}
                  />
                </div>
                <Text className="dashboard-chart__value">{row.count}</Text>
              </div>
            ))
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <Title3>Narrative Insights</Title3>
      <ul className="dashboard-narratives__list">
        {dataset.narrativeBlocks.length === 0 ? (
          <li>
            <Text>No narrative insights available.</Text>
          </li>
        ) : (
          dataset.narrativeBlocks.map((block) => (
            <li key={block.id}>
              <Text weight="semibold">{block.title}</Text>
              <Text>{block.body}</Text>
            </li>
          ))
        )}
      </ul>
    </>
  );
}

export function DashboardPage() {
  const { selectedScenarioId, selectedScenario } = useScenarioContext();
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const [dataset, setDataset] = useState<DashboardDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [selectedRange, setSelectedRange] = useState<DashboardRange>("12m");
  const [exportFiles, setExportFiles] = useState<
    Partial<Record<ExportFormat, string>>
  >({});
  const [layout, setLayout] = useState<DashboardLayout>(() => loadDashboardLayout());
  const [editLayout, setEditLayout] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");

  const visibleDataset = useMemo(
    () => (dataset ? filterDashboardDatasetByRange(dataset, selectedRange) : null),
    [dataset, selectedRange]
  );
  const kpis = useMemo(
    () => (visibleDataset ? buildDashboardKpiMetrics(visibleDataset) : null),
    [visibleDataset]
  );
  const staleState = useMemo(
    () => (dataset ? mapDashboardStaleState(dataset) : { isStale: false, message: null }),
    [dataset]
  );
  const maxSpendMinor = useMemo(() => {
    if (!visibleDataset || visibleDataset.spendTrend.length === 0) {
      return 0;
    }
    return Math.max(
      ...visibleDataset.spendTrend.map((row) => Math.max(row.forecastMinor, row.actualMinor))
    );
  }, [visibleDataset]);
  const maxRenewalCount = useMemo(() => {
    if (!visibleDataset || visibleDataset.renewals.length === 0) {
      return 0;
    }
    return Math.max(...visibleDataset.renewals.map((row) => row.count));
  }, [visibleDataset]);
  const maxVarianceMinor = useMemo(() => {
    if (!visibleDataset || visibleDataset.variance.length === 0) {
      return 0;
    }
    return Math.max(...visibleDataset.variance.map((row) => Math.abs(row.varianceMinor)));
  }, [visibleDataset]);
  const maxGrowthPct = useMemo(() => {
    if (!visibleDataset || visibleDataset.growth.length === 0) {
      return 0;
    }
    return Math.max(...visibleDataset.growth.map((row) => Math.abs(row.growthPct ?? 0)));
  }, [visibleDataset]);
  const maxReplacementStatusCount = useMemo(() => {
    if (!dataset || dataset.replacementStatus.byStatus.length === 0) {
      return 0;
    }
    return Math.max(...dataset.replacementStatus.byStatus.map((row) => row.count));
  }, [dataset]);

  const sectionsWithCards = useMemo(
    () =>
      layout.sections.map((section) => ({
        ...section,
        cards: layout.cards.filter((card) => card.sectionId === section.id && card.visible)
      })),
    [layout]
  );
  const visibleSections = useMemo(
    () => sectionsWithCards.filter((section) => section.cards.length > 0),
    [sectionsWithCards]
  );

  useEffect(() => {
    saveDashboardLayout(layout);
  }, [layout]);

  async function loadDashboard(
    scenarioId: string,
    options: { silent?: boolean } = {}
  ): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const next = (await queryReport({
        query: "dashboard.summary",
        scenarioId
      })) as DashboardDataset;
      setDataset(next);
      if (!options.silent) {
        notify({
          tone: "success",
          message: "Dashboard data refreshed."
        });
      }
    } catch (nextError) {
      const detail = nextError instanceof Error ? nextError.message : String(nextError);
      const message = `Failed to load dashboard: ${detail}`;
      setError(message);
      notify({
        tone: "error",
        message
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard(selectedScenarioId, { silent: true });
  }, [notify, selectedScenarioId]);

  async function handleExport(format: ExportFormat): Promise<void> {
    setExportingFormat(format);
    try {
      const result = await exportReport({
        reportType: "dashboard.summary",
        scenarioId: selectedScenarioId,
        outputDir: "C:\\exports",
        formats: [format]
      });
      setExportFiles(result.files);
      notify({
        tone: "success",
        message: `Exported ${format.toUpperCase()} report.`
      });
    } catch (nextError) {
      const detail = nextError instanceof Error ? nextError.message : String(nextError);
      notify({
        tone: "error",
        message: `Export failed for ${format.toUpperCase()}: ${detail}`
      });
    } finally {
      setExportingFormat(null);
    }
  }

  function addSection(): void {
    const next = addDashboardLayoutSection(layout, newSectionName);
    if (next === layout) {
      notify({ tone: "warning", message: "Enter a section name to add." });
      return;
    }
    setLayout(next);
    setNewSectionName("");
    notify({ tone: "success", message: "Dashboard section added." });
  }

  return (
    <section className="dashboard-page" aria-live="polite">
      <PageHeader
        title="Dashboard"
        subtitle={`Decision-ready view for forecast, actuals, renewals, and replacement readiness. Active scenario: ${
          selectedScenario?.name ?? selectedScenarioId
        }. Window: ${formatMonthWindow(DASHBOARD_RANGE_MONTHS[selectedRange])}.`}
        actions={
          <div className="dashboard-page__actions">
            <div className="dashboard-page__range" role="group" aria-label="Dashboard range">
              {DASHBOARD_RANGE_OPTIONS.map((option) => (
                <Button
                  key={option.id}
                  appearance={selectedRange === option.id ? "primary" : "secondary"}
                  onClick={() => setSelectedRange(option.id)}
                  size="small"
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Button
              appearance="secondary"
              onClick={() => void loadDashboard(selectedScenarioId)}
            >
              Refresh
            </Button>
            <Button
              appearance={editLayout ? "primary" : "secondary"}
              onClick={() => setEditLayout((current) => !current)}
            >
              {editLayout ? "Done editing" : "Edit layout"}
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

      {editLayout ? (
        <Card className="dashboard-layout-editor" data-testid="dashboard-layout-editor">
          <div className="dashboard-layout-editor__header">
            <Text weight="semibold">Customize dashboard cards</Text>
            <Button
              appearance="secondary"
              onClick={() => {
                setLayout(createDefaultDashboardLayout());
                notify({ tone: "success", message: "Dashboard layout reset to defaults." });
              }}
            >
              Reset defaults
            </Button>
          </div>
          <div className="dashboard-layout-editor__new-section">
            <Input
              aria-label="New dashboard section name"
              value={newSectionName}
              onChange={(_event, data) => setNewSectionName(data.value)}
              placeholder="Add section (for example: Reliability)"
            />
            <Button appearance="secondary" onClick={addSection}>
              Add section
            </Button>
          </div>
          <ul className="dashboard-layout-editor__list">
            {layout.cards.map((card, index) => {
              const definition = DASHBOARD_CARD_DEFINITION_MAP[card.id];
              return (
                <li key={card.id} className="dashboard-layout-editor__item">
                  <Text weight="semibold">{definition.title}</Text>
                  <Checkbox
                    aria-label={`Toggle ${definition.title} card`}
                    label="Visible"
                    checked={card.visible}
                    onChange={(_event, data) =>
                      setLayout((current) =>
                        updateDashboardCardVisibility(current, card.id, data.checked === true)
                      )
                    }
                  />
                  <Select
                    aria-label={`Section for ${definition.title}`}
                    value={card.sectionId}
                    onChange={(event) =>
                      setLayout((current) =>
                        assignDashboardCardSection(current, card.id, event.target.value)
                      )
                    }
                  >
                    {layout.sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </Select>
                  <div className="dashboard-layout-editor__reorder">
                    <Button
                      appearance="secondary"
                      size="small"
                      disabled={index === 0}
                      aria-label={`Move ${definition.title} up`}
                      onClick={() =>
                        setLayout((current) => moveDashboardCard(current, card.id, "up"))
                      }
                    >
                      Up
                    </Button>
                    <Button
                      appearance="secondary"
                      size="small"
                      disabled={index === layout.cards.length - 1}
                      aria-label={`Move ${definition.title} down`}
                      onClick={() =>
                        setLayout((current) => moveDashboardCard(current, card.id, "down"))
                      }
                    >
                      Down
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {staleState.isStale ? (
        <Card className="dashboard-page__stale-card" data-testid="stale-forecast-banner">
          <Text weight="semibold">Forecast freshness warning</Text>
          <Text>{staleState.message}</Text>
          <Button
            appearance="secondary"
            onClick={() => navigate("/settings?section=maintenance")}
          >
            Open Settings
          </Button>
        </Card>
      ) : null}

      <Text data-testid="dashboard-scenario-context">{`Scenario: ${
        selectedScenario?.name ?? selectedScenarioId
      }`}</Text>

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

      {loading && !dataset ? (
        <LoadingState label="Loading dashboard..." />
      ) : error ? (
        <InlineError
          message={error}
          action={
            <Button
              appearance="secondary"
              onClick={() => void loadDashboard(selectedScenarioId)}
              size="small"
            >
              Retry
            </Button>
          }
        />
      ) : !dataset || !kpis ? (
        <EmptyState
          title="No dashboard data available"
          description="Import or create records to populate dashboard insights."
        />
      ) : (
        <>
          <Text>{`Showing last ${formatMonthWindow(DASHBOARD_RANGE_MONTHS[selectedRange])}.`}</Text>
          <ErrorBoundary label="Dashboard chart widgets failed">
            {visibleSections.length === 0 ? (
              <EmptyState
                title="No visible cards"
                description="Turn cards on in Edit layout to populate the dashboard."
              />
            ) : (
              <div className="dashboard-sections">
                {visibleSections.map((section) => (
                  <section
                    key={section.id}
                    className="dashboard-section"
                    data-testid={`dashboard-section-${section.id}`}
                  >
                    <div className="dashboard-section__header">
                      <Title3>{section.name}</Title3>
                      <Text>{`${section.cards.length} card${section.cards.length === 1 ? "" : "s"}`}</Text>
                    </div>
                    <div className="dashboard-section__grid">
                      {section.cards.map((card) => (
                        <Card
                          key={card.id}
                          className={getDashboardCardClassName(card.id)}
                          data-testid={`dashboard-card-${card.id}`}
                        >
                          {renderDashboardCard(card.id, {
                            dataset,
                            visibleDataset,
                            kpis,
                            maxSpendMinor,
                            maxRenewalCount,
                            maxVarianceMinor,
                            maxGrowthPct,
                            maxReplacementStatusCount
                          })}
                        </Card>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </ErrorBoundary>
        </>
      )}
    </section>
  );
}
