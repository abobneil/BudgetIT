import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Title3
} from "@fluentui/react-components";

import { PageHeader, StatusChip } from "../../ui/primitives";
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
    cloneScenario,
    promoteScenario,
    lockScenario
  } = useScenarioContext();
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
  const comparisonText = comparisonScenarioId
    ? compareScenarioToBaseline(
        { scenarios, selectedScenarioId },
        comparisonScenarioId
      )
    : null;

  function formatMoney(minor: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(minor / 100);
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
          baselineScenarioId: "baseline",
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

  return (
    <section className="scenarios-page">
      <PageHeader
        title="Scenarios Workspace"
        subtitle="Clone, promote, lock, and compare scenarios with global context selection."
      />

      <Card className="scenarios-page__summary">
        <Title3>Active scenario</Title3>
        <Text data-testid="selected-scenario-summary">
          {selectedScenario ? selectedScenario.name : "No active scenario"}
        </Text>
      </Card>

      {comparisonText ? (
        <Card data-testid="scenario-comparison">
          <Text weight="semibold">Comparison to Baseline</Text>
          <Text>{comparisonText}</Text>
        </Card>
      ) : null}
      {comparisonResult ? (
        <Card data-testid="scenario-comparison-db">
          <Text weight="semibold">Comparison delta (database)</Text>
          <Text>{`Baseline ${comparisonResult.baselineScenarioId}: ${comparisonResult.baseline.expenseCount} expenses, ${formatMoney(comparisonResult.baseline.totalMinor)}, ${comparisonResult.baseline.classifiedExpenseCount} classified`}</Text>
          <Text>{`Selected ${comparisonResult.comparisonScenarioId}: ${comparisonResult.comparison.expenseCount} expenses, ${formatMoney(comparisonResult.comparison.totalMinor)}, ${comparisonResult.comparison.classifiedExpenseCount} classified`}</Text>
          <Text>{`Delta: ${comparisonResult.delta.expenseCount} expenses, ${formatMoney(comparisonResult.delta.totalMinor)}, ${comparisonResult.delta.classifiedExpenseCount} classified`}</Text>
        </Card>
      ) : null}
      {comparisonError ? <Text>{comparisonError}</Text> : null}

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
                          <MenuItem onClick={() => cloneScenario(scenario.id)}>
                            Clone
                          </MenuItem>
                          <MenuItem
                            disabled={scenario.locked || scenario.status === "approved"}
                            onClick={() => promoteScenario(scenario.id)}
                          >
                            Promote
                          </MenuItem>
                          <MenuItem
                            disabled={scenario.locked}
                            onClick={() => lockScenario(scenario.id)}
                          >
                            Lock
                          </MenuItem>
                          <MenuItem onClick={() => handleCompareScenario(scenario.id)}>
                            Compare
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
    </section>
  );
}

