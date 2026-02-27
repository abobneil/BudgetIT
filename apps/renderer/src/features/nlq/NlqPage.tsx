import { useMemo, useState } from "react";
import {
  Button,
  Card,
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

import { exportReport, parseNlq } from "../../lib/ipcClient";
import { InlineError, PageHeader } from "../../ui/primitives";
import { saveReportPreset } from "../reports/reports-config-model";
import { useScenarioContext } from "../scenarios/ScenarioContext";
import {
  addNlqHistoryEntry,
  loadNlqHistory,
  persistNlqHistory
} from "./nlq-history-model";
import "./NlqPage.css";

type ResultSortKey = "name" | "amount_minor";
type ResultSortDirection = "asc" | "desc";
type ExportFormat = "csv" | "excel";

const PROFILE_ID = "default-profile";
const EXAMPLE_QUERIES = [
  "show renewals in next 90 days",
  "forecast spend above $1000 tagged security",
  "variance for finance services this quarter"
];

function sortResults(
  rows: Array<{ id: string; name: string; amount_minor: number }>,
  sortKey: ResultSortKey,
  direction: ResultSortDirection
): Array<{ id: string; name: string; amount_minor: number }> {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    if (sortKey === "amount_minor") {
      return (left.amount_minor - right.amount_minor) * multiplier;
    }
    return left.name.localeCompare(right.name) * multiplier;
  });
}

export function NlqPage() {
  const { selectedScenarioId } = useScenarioContext();
  const [queryInput, setQueryInput] = useState("");
  const [history, setHistory] = useState(() => loadNlqHistory(PROFILE_ID));
  const [result, setResult] = useState<{
    filterSpec: Record<string, unknown>;
    explanation: string;
    rows: Array<{ id: string; name: string; amount_minor: number }>;
  } | null>(null);
  const [sortKey, setSortKey] = useState<ResultSortKey>("name");
  const [sortDirection, setSortDirection] = useState<ResultSortDirection>("asc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [saveReportName, setSaveReportName] = useState("");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [exportPath, setExportPath] = useState("C:\\exports");

  const sortedRows = useMemo(() => {
    if (!result) {
      return [];
    }
    return sortResults(result.rows, sortKey, sortDirection);
  }, [result, sortDirection, sortKey]);

  async function runQuery(query: string): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) {
      setError("Enter a query before running NLQ.");
      return;
    }

    setLoading(true);
    setError(null);
    setPageMessage(null);
    try {
      const parsed = await parseNlq({
        query: trimmed
      });
      setResult(parsed);
      const nextHistory = addNlqHistoryEntry(history, trimmed, new Date().toISOString());
      setHistory(nextHistory);
      persistNlqHistory(PROFILE_ID, nextHistory);
      setQueryInput(trimmed);
      setPageMessage(`Query matched ${parsed.rows.length} row(s).`);
    } catch (nextError) {
      const detail = nextError instanceof Error ? nextError.message : String(nextError);
      setError(`NLQ parse failed: ${detail}`);
    } finally {
      setLoading(false);
    }
  }

  async function exportResults(): Promise<void> {
    if (!result) {
      setError("Run an NLQ query before exporting.");
      return;
    }
    setError(null);
    try {
      const exported = await exportReport({
        scenarioId: selectedScenarioId,
        reportType: "nlq.results",
        formats: [exportFormat],
        destinationPath: exportPath,
        filterSpec: result.filterSpec
      });
      const output = exported.files[exportFormat];
      setPageMessage(output ? `Exported to ${output}` : "Export completed.");
    } catch (nextError) {
      const detail = nextError instanceof Error ? nextError.message : String(nextError);
      setError(`Export failed: ${detail}`);
    }
  }

  function saveAsReport(): void {
    if (!result) {
      setError("Run an NLQ query before saving a report preset.");
      return;
    }
    const trimmedName = saveReportName.trim();
    if (!trimmedName) {
      setError("Provide a report name before saving.");
      return;
    }

    const id = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    saveReportPreset({
      id,
      title: trimmedName,
      description: `Saved from NLQ: ${queryInput}`,
      query: "nlq.saved",
      visualizations: {
        table: true,
        chart: false,
        gauge: false,
        narrative: true
      }
    });
    setPageMessage(`Saved report preset: ${trimmedName}.`);
  }

  function toggleSort(nextSortKey: ResultSortKey): void {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextSortKey);
    setSortDirection("asc");
  }

  return (
    <section className="nlq-page">
      <PageHeader
        title="NLQ Workspace"
        subtitle="Run natural language queries, inspect parsed filters, and convert results to reusable reports."
      />

      <Card>
        <Title3>Prompt</Title3>
        <div className="nlq-page__prompt">
          <Input
            aria-label="NLQ prompt input"
            value={queryInput}
            onChange={(_event, data) => setQueryInput(data.value)}
            placeholder="Ask a budgeting question..."
          />
          <Button appearance="primary" disabled={loading} onClick={() => void runQuery(queryInput)}>
            {loading ? "Running..." : "Run query"}
          </Button>
        </div>
        <div className="nlq-page__examples">
          {EXAMPLE_QUERIES.map((query) => (
            <Button
              key={query}
              size="small"
              appearance="secondary"
              onClick={() => setQueryInput(query)}
            >
              {query}
            </Button>
          ))}
        </div>
      </Card>

      <Card>
        <Title3>Query History</Title3>
        {history.length === 0 ? (
          <Text>No history yet.</Text>
        ) : (
          <ul className="nlq-page__history">
            {history.map((entry) => (
              <li key={`${entry.query}-${entry.lastRunAt}`}>
                <Button
                  size="small"
                  appearance="secondary"
                  onClick={() => void runQuery(entry.query)}
                >
                  {entry.query}
                </Button>
                <Text>{`runs: ${entry.runCount}`}</Text>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {result ? (
        <>
          <Card>
            <Title3>Parsed FilterSpec</Title3>
            <Text>{result.explanation}</Text>
            <pre className="nlq-page__filter-preview">
              {JSON.stringify(result.filterSpec, null, 2)}
            </pre>
          </Card>

          <Card>
            <Title3>Matched Rows</Title3>
            <Table aria-label="NLQ results table">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>ID</TableHeaderCell>
                  <TableHeaderCell>
                    <Button size="small" appearance="subtle" onClick={() => toggleSort("name")}>
                      Name
                    </Button>
                  </TableHeaderCell>
                  <TableHeaderCell>
                    <Button
                      size="small"
                      appearance="subtle"
                      onClick={() => toggleSort("amount_minor")}
                    >
                      Amount
                    </Button>
                  </TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.id}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.amount_minor}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="nlq-page__actions">
              <Select
                aria-label="NLQ export format"
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
              >
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
              </Select>
              <Input
                aria-label="NLQ export path"
                value={exportPath}
                onChange={(_event, data) => setExportPath(data.value)}
                placeholder="C:\\exports"
              />
              <Button appearance="secondary" onClick={() => void exportResults()}>
                Export results
              </Button>
            </div>
          </Card>

          <Card>
            <Title3>Save as Report</Title3>
            <div className="nlq-page__save-report">
              <Input
                aria-label="Save report name"
                value={saveReportName}
                onChange={(_event, data) => setSaveReportName(data.value)}
                placeholder="Quarterly security variance"
              />
              <Button appearance="primary" onClick={saveAsReport}>
                Save as report
              </Button>
            </div>
          </Card>
        </>
      ) : null}

      {error ? <InlineError message={error} /> : null}
      {pageMessage ? <Text>{pageMessage}</Text> : null}
    </section>
  );
}

