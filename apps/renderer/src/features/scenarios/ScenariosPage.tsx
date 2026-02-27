import { useMemo, useState } from "react";
import {
  Button,
  Card,
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
                    label={scenario.status.toUpperCase()}
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
                      appearance="secondary"
                      onClick={() => selectScenario(scenario.id)}
                    >
                      Select
                    </Button>
                    <Button
                      size="small"
                      appearance="secondary"
                      onClick={() => cloneScenario(scenario.id)}
                    >
                      Clone
                    </Button>
                    <Button
                      size="small"
                      appearance="secondary"
                      disabled={scenario.locked || scenario.status === "approved"}
                      onClick={() => promoteScenario(scenario.id)}
                    >
                      Promote
                    </Button>
                    <Button
                      size="small"
                      appearance="secondary"
                      disabled={scenario.locked}
                      onClick={() => lockScenario(scenario.id)}
                    >
                      Lock
                    </Button>
                    <Button
                      size="small"
                      appearance="secondary"
                      onClick={() => setComparisonScenarioId(scenario.id)}
                    >
                      Compare
                    </Button>
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

