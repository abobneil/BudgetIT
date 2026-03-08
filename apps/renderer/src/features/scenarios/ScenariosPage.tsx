import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Input,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
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

import { ConfirmDialog, InlineError, PageHeader, StatusChip } from "../../ui/primitives";
import { formatCurrencyMinor, useScenarioCurrency } from "../../lib/currency";
import { isIpcAvailable, queryReport } from "../../lib/ipcClient";
import { toTitleCaseLabel } from "../../ui/text/labelCase";
import { useScenarioContext } from "./ScenarioContext";
import { compareScenarioToBaseline } from "./scenario-model";
import "./ScenariosPage.css";

function statusToTone(status: "draft" | "reviewed" | "approved"): "info" | "warning" | "success" {
  if (status === "approved") {
    return "success";
  }
  if (status === "reviewed") {
    return "warning";
  }
  return "info";
}

function formatCreatedDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export function ScenariosPage() {
  const hasIpc = isIpcAvailable();
  const {
    scenarios,
    selectedScenario,
    selectedScenarioId,
    selectScenario,
    createScenario,
    cloneScenario,
    deleteScenario,
    promoteScenario,
    lockScenario
  } = useScenarioContext();
  const displayCurrency = useScenarioCurrency(selectedScenarioId);
  const [newScenarioName, setNewScenarioName] = useState("");
  const [newScenarioParentId, setNewScenarioParentId] = useState("");
  const [hasInitializedParent, setHasInitializedParent] = useState(false);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [deleteScenarioId, setDeleteScenarioId] = useState<string | null>(null);
  const [comparisonScenarioId, setComparisonScenarioId] = useState<string | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<null | {
    baselineScenarioId: string;
    comparisonScenarioId: string;
    baseline: {
      expenseCount: number;
      totalMinor: number;
      classifiedExpenseCount: number;
    };
    comparison: {
      expenseCount: number;
      totalMinor: number;
      classifiedExpenseCount: number;
    };
    delta: {
      expenseCount: number;
      totalMinor: number;
      classifiedExpenseCount: number;
    };
    generatedAt: string;
  }>(null);

  const scenarioNameById = useMemo(
    () =>
      Object.fromEntries(scenarios.map((scenario) => [scenario.id, scenario.name])),
    [scenarios]
  );
  const baselineScenarioId = useMemo(
    () => scenarios.find((scenario) => scenario.parentScenarioId === null)?.id ?? "baseline",
    [scenarios]
  );
  const childScenarioIds = useMemo(
    () =>
      new Set(
        scenarios.flatMap((scenario) =>
          scenario.parentScenarioId ? [scenario.parentScenarioId] : []
        )
      ),
    [scenarios]
  );
  const comparisonText = comparisonScenarioId
    ? compareScenarioToBaseline(
        { scenarios, selectedScenarioId },
        comparisonScenarioId
      )
    : null;

  useEffect(() => {
    if (!hasInitializedParent && baselineScenarioId) {
      setNewScenarioParentId(baselineScenarioId);
      setHasInitializedParent(true);
      return;
    }
    if (newScenarioParentId && !scenarios.some((scenario) => scenario.id === newScenarioParentId)) {
      setNewScenarioParentId(baselineScenarioId);
    }
  }, [baselineScenarioId, hasInitializedParent, newScenarioParentId, scenarios]);

  async function handleCreateScenario(): Promise<void> {
    const trimmedName = newScenarioName.trim();
    if (!trimmedName) {
      setPageError("Scenario name is required.");
      return;
    }
    if (scenarios.some((scenario) => scenario.name.toLowerCase() === trimmedName.toLowerCase())) {
      setPageError("Scenario name already exists.");
      return;
    }

    try {
      setPageError(null);
      await createScenario(trimmedName, newScenarioParentId || null);
      setNewScenarioName("");
      setPageMessage(`Scenario ${trimmedName} created.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setPageError(`Create failed: ${detail}`);
    }
  }

  async function handleCloneScenario(scenarioId: string): Promise<void> {
    const scenarioName = scenarioNameById[scenarioId] ?? "Scenario";
    try {
      setPageError(null);
      await cloneScenario(scenarioId);
      setPageMessage(`${scenarioName} cloned.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setPageError(`Clone failed: ${detail}`);
    }
  }

  async function handlePromoteScenario(scenarioId: string): Promise<void> {
    const scenarioName = scenarioNameById[scenarioId] ?? "Scenario";
    try {
      setPageError(null);
      await promoteScenario(scenarioId);
      setPageMessage(`${scenarioName} promoted.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setPageError(`Promote failed: ${detail}`);
    }
  }

  async function handleLockScenario(scenarioId: string): Promise<void> {
    const scenarioName = scenarioNameById[scenarioId] ?? "Scenario";
    try {
      setPageError(null);
      await lockScenario(scenarioId);
      setPageMessage(`${scenarioName} locked.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setPageError(`Lock failed: ${detail}`);
    }
  }

  function handleCompareScenario(scenarioId: string): void {
    setComparisonScenarioId(scenarioId);
    if (!hasIpc) {
      return;
    }

    void (async () => {
      try {
        const result = (await queryReport({
          query: "scenario.comparison",
          baselineScenarioId,
          comparisonScenarioId: scenarioId,
          scenarioId
        })) as {
          baselineScenarioId: string;
          comparisonScenarioId: string;
          baseline: {
            expenseCount: number;
            totalMinor: number;
            classifiedExpenseCount: number;
          };
          comparison: {
            expenseCount: number;
            totalMinor: number;
            classifiedExpenseCount: number;
          };
          delta: {
            expenseCount: number;
            totalMinor: number;
            classifiedExpenseCount: number;
          };
          generatedAt: string;
        };
        setComparisonError(null);
        setComparisonResult(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setComparisonError(`Comparison failed: ${message}`);
        setComparisonResult(null);
      }
    })();
  }

  async function handleConfirmDeleteScenario(): Promise<void> {
    if (!deleteScenarioId) {
      return;
    }

    const scenarioName = scenarioNameById[deleteScenarioId] ?? deleteScenarioId;
    try {
      setPageError(null);
      await deleteScenario(deleteScenarioId);
      setDeleteScenarioId(null);
      setPageMessage(`Scenario ${scenarioName} deleted.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setPageError(`Delete failed: ${detail}`);
      setDeleteScenarioId(null);
    }
  }

  return (
    <section className="scenarios-page">
      <PageHeader
        title="Scenarios Workspace"
        subtitle="Create, clone, promote, lock, delete, and compare scenarios with global context selection."
      />

      <Card className="scenarios-page__summary">
        <Title3>Active scenario</Title3>
        <Text data-testid="selected-scenario-summary">
          {selectedScenario ? selectedScenario.name : "No active scenario"}
        </Text>
      </Card>

      <Card className="scenarios-page__create">
        <Title3>Create scenario</Title3>
        <div className="scenarios-page__create-controls">
          <Input
            aria-label="New scenario name"
            placeholder="Scenario name"
            value={newScenarioName}
            onChange={(_event, data) => setNewScenarioName(data.value)}
          />
          <Select
            aria-label="Parent scenario"
            value={newScenarioParentId}
            onChange={(event) => setNewScenarioParentId(event.target.value)}
          >
            <option value="">No parent</option>
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </Select>
          <Button
            appearance="primary"
            onClick={() => void handleCreateScenario()}
            disabled={!newScenarioName.trim()}
          >
            Create Scenario
          </Button>
        </div>
        <Text size={200}>
          Creates a blank scenario. Use Clone when you want to copy expenses and recurrences.
        </Text>
      </Card>

      {pageError ? <InlineError message={pageError} /> : null}
      {pageMessage ? <Text>{pageMessage}</Text> : null}

      {comparisonText ? (
        <Card data-testid="scenario-comparison">
          <Text weight="semibold">Comparison to Baseline</Text>
          <Text>{comparisonText}</Text>
        </Card>
      ) : null}
      {comparisonResult ? (
        <Card data-testid="scenario-comparison-db">
          <Text weight="semibold">Comparison delta (database)</Text>
          <Text>{`Baseline ${comparisonResult.baselineScenarioId}: ${comparisonResult.baseline.expenseCount} expenses, ${formatCurrencyMinor(comparisonResult.baseline.totalMinor, displayCurrency)}, ${comparisonResult.baseline.classifiedExpenseCount} classified`}</Text>
          <Text>{`Selected ${comparisonResult.comparisonScenarioId}: ${comparisonResult.comparison.expenseCount} expenses, ${formatCurrencyMinor(comparisonResult.comparison.totalMinor, displayCurrency)}, ${comparisonResult.comparison.classifiedExpenseCount} classified`}</Text>
          <Text>{`Delta: ${comparisonResult.delta.expenseCount} expenses, ${formatCurrencyMinor(comparisonResult.delta.totalMinor, displayCurrency)}, ${comparisonResult.delta.classifiedExpenseCount} classified`}</Text>
        </Card>
      ) : null}
      {comparisonError ? <InlineError message={comparisonError} /> : null}

      <Table aria-label="Scenarios table">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Lock</TableHeaderCell>
            <TableHeaderCell>Parent</TableHeaderCell>
            <TableHeaderCell>Created</TableHeaderCell>
            <TableHeaderCell>Actions</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scenarios.map((scenario) => {
            const isSelected = scenario.id === selectedScenarioId;
            const canDelete =
              scenario.id !== baselineScenarioId &&
              !scenario.locked &&
              !childScenarioIds.has(scenario.id);

            return (
              <TableRow
                key={scenario.id}
                data-testid={`scenario-row-${scenario.id}`}
                className={
                  isSelected ? "scenarios-page__row scenarios-page__row--selected" : "scenarios-page__row"
                }
              >
                <TableCell>{scenario.name}</TableCell>
                <TableCell>
                  <StatusChip
                    label={toTitleCaseLabel(scenario.status)}
                    tone={statusToTone(scenario.status)}
                  />
                </TableCell>
                <TableCell>{scenario.locked ? "Locked" : "Open"}</TableCell>
                <TableCell>
                  {scenario.parentScenarioId
                    ? (scenarioNameById[scenario.parentScenarioId] ?? scenario.parentScenarioId)
                    : "None"}
                </TableCell>
                <TableCell>{formatCreatedDate(scenario.createdAt)}</TableCell>
                <TableCell>
                  <div className="scenarios-page__actions">
                    <Button
                      size="small"
                      appearance={isSelected ? "primary" : "secondary"}
                      onClick={() => selectScenario(scenario.id)}
                    >
                      Select
                    </Button>
                    <Menu>
                      <MenuTrigger disableButtonEnhancement>
                        <Button size="small" appearance="secondary">
                          More
                        </Button>
                      </MenuTrigger>
                      <MenuPopover>
                        <MenuList>
                          <MenuItem onClick={() => void handleCloneScenario(scenario.id)}>
                            Clone
                          </MenuItem>
                          <MenuItem
                            disabled={scenario.locked || scenario.status === "approved"}
                            onClick={() => void handlePromoteScenario(scenario.id)}
                          >
                            Promote
                          </MenuItem>
                          <MenuItem
                            disabled={scenario.locked}
                            onClick={() => void handleLockScenario(scenario.id)}
                          >
                            Lock
                          </MenuItem>
                          <MenuItem onClick={() => handleCompareScenario(scenario.id)}>
                            Compare
                          </MenuItem>
                          <MenuItem
                            disabled={!canDelete}
                            onClick={() => setDeleteScenarioId(scenario.id)}
                          >
                            Delete
                          </MenuItem>
                        </MenuList>
                      </MenuPopover>
                    </Menu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={deleteScenarioId !== null}
        title="Delete scenario?"
        message="Delete removes this scenario and its scenario-specific records. Baseline, locked scenarios, and scenarios with children cannot be deleted."
        onOpenChange={(open) => {
          if (!open) {
            setDeleteScenarioId(null);
          }
        }}
        onConfirm={() => {
          void handleConfirmDeleteScenario();
        }}
        confirmLabel="Delete"
      />
    </section>
  );
}
