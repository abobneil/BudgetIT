import { useMemo, useState } from "react";
import {
  Badge,
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

import { commitImport, previewImport } from "../../lib/ipcClient";
import { InlineError, PageHeader } from "../../ui/primitives";
import {
  buildImportPayload,
  canAdvanceStep,
  createInitialImportWizardDraft,
  filterImportErrors,
  IMPORT_WIZARD_STEPS,
  nextStep,
  previousStep,
  type ImportErrorFilter,
  type ImportWizardStep
} from "./import-wizard-model";
import "./ImportPage.css";

type PreviewRow = {
  rowNumber: number;
  name: string;
  amount: string;
  status: "accepted" | "rejected" | "duplicate";
};

type TagSuggestion = {
  id: string;
  label: string;
  selected: boolean;
};

const PREVIEW_ROWS_BY_MODE: Record<"expenses" | "actuals", PreviewRow[]> = {
  expenses: [
    { rowNumber: 1, name: "Cloud Compute", amount: "$2,400.00", status: "accepted" },
    { rowNumber: 2, name: "Endpoint Security", amount: "$840.00", status: "duplicate" },
    { rowNumber: 3, name: "Analytics Suite", amount: "$1,250.00", status: "rejected" }
  ],
  actuals: [
    { rowNumber: 1, name: "Invoice 8820", amount: "$2,400.00", status: "accepted" },
    { rowNumber: 2, name: "Invoice 8821", amount: "$840.00", status: "duplicate" },
    { rowNumber: 3, name: "Invoice 8822", amount: "$770.00", status: "rejected" }
  ]
};

const DEFAULT_TAG_SUGGESTIONS: TagSuggestion[] = [
  { id: "suggestion-msft-security", label: "Vendor contains Microsoft -> Cost Center: Security", selected: true },
  { id: "suggestion-aws-engineering", label: "Vendor contains AWS -> Cost Center: Engineering", selected: true },
  { id: "suggestion-prod-env", label: "Description contains production -> Environment: Production", selected: false }
];

function stepLabel(step: ImportWizardStep): string {
  if (step === "mode") {
    return "Mode";
  }
  if (step === "file") {
    return "File";
  }
  if (step === "mapping") {
    return "Mapping";
  }
  if (step === "preview") {
    return "Preview";
  }
  return "Commit";
}

export function ImportPage() {
  const [draft, setDraft] = useState(() => createInitialImportWizardDraft());
  const [currentStep, setCurrentStep] = useState<ImportWizardStep>("mode");
  const [errorFilter, setErrorFilter] = useState<ImportErrorFilter>("all");
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [tagSuggestions, setTagSuggestions] = useState<TagSuggestion[]>(
    DEFAULT_TAG_SUGGESTIONS
  );

  const filteredErrors = useMemo(() => {
    if (!draft.previewResult) {
      return [];
    }
    return filterImportErrors(draft.previewResult.errors, errorFilter);
  }, [draft.previewResult, errorFilter]);
  const previewRows = PREVIEW_ROWS_BY_MODE[draft.mode];
  const selectedSuggestionCount = tagSuggestions.filter((entry) => entry.selected).length;

  function onNext(): void {
    if (!canAdvanceStep(currentStep, draft)) {
      if (currentStep === "file") {
        setPageError("Choose a file path before moving to mapping.");
      } else if (currentStep === "preview") {
        setPageError("Run preview before moving to commit.");
      } else {
        setPageError("Complete required fields before moving to next step.");
      }
      return;
    }
    setPageError(null);
    setCurrentStep((current) => nextStep(current, draft));
  }

  function onBack(): void {
    setPageError(null);
    setCurrentStep((current) => previousStep(current));
  }

  async function onRunPreview(): Promise<void> {
    setBusy(true);
    setPageError(null);
    setPageMessage(null);
    try {
      const result = await previewImport(buildImportPayload(draft));
      setDraft((current) => ({ ...current, previewResult: result, commitResult: null }));
      setPageMessage(
        `Preview loaded: ${result.acceptedCount} accepted, ${result.rejectedCount} rejected, ${result.duplicateCount} duplicates.`
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setPageError(`Preview failed: ${detail}`);
    } finally {
      setBusy(false);
    }
  }

  async function onRunCommit(): Promise<void> {
    setBusy(true);
    setPageError(null);
    setPageMessage(null);
    try {
      const result = await commitImport(buildImportPayload(draft));
      setDraft((current) => ({ ...current, commitResult: result }));
      setPageMessage(
        `Commit completed: ${result.insertedCount} inserted, ${result.rejectedCount} rejected, ${result.duplicateCount} duplicates.`
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setPageError(`Commit failed: ${detail}`);
    } finally {
      setBusy(false);
    }
  }

  function toggleSuggestion(id: string, checked: boolean): void {
    setTagSuggestions((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, selected: checked } : entry))
    );
  }

  return (
    <section className="import-page">
      <PageHeader
        title="Import Wizard"
        subtitle="Guided stepper for mode, mapping, preview, and commit with deterministic dedupe outcomes."
      />

      <Card>
        <ol className="import-stepper">
          {IMPORT_WIZARD_STEPS.map((step) => (
            <li
              key={step}
              className={
                step === currentStep
                  ? "import-stepper__item import-stepper__item--active"
                  : "import-stepper__item"
              }
              data-testid={`import-step-${step}`}
            >
              {stepLabel(step)}
            </li>
          ))}
        </ol>
      </Card>

      {currentStep === "mode" ? (
        <Card>
          <Title3>Step 1: Select import mode</Title3>
          <Select
            aria-label="Import mode"
            value={draft.mode}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                mode: event.target.value as "expenses" | "actuals",
                previewResult: null,
                commitResult: null
              }))
            }
          >
            <option value="expenses">Expenses</option>
            <option value="actuals">Actuals</option>
          </Select>
        </Card>
      ) : null}

      {currentStep === "file" ? (
        <Card>
          <Title3>Step 2: Select file</Title3>
          <Input
            aria-label="Import file path"
            value={draft.filePath}
            onChange={(_event, data) =>
              setDraft((current) => ({ ...current, filePath: data.value }))
            }
            placeholder="C:\\imports\\budget.xlsx"
          />
        </Card>
      ) : null}

      {currentStep === "mapping" ? (
        <Card>
          <Title3>Step 3: Mapping template</Title3>
          <Input
            aria-label="Mapping template"
            value={draft.templateName}
            onChange={(_event, data) =>
              setDraft((current) => ({ ...current, templateName: data.value }))
            }
            placeholder="default-expense-import"
          />
          <div className="import-flags">
            <Checkbox
              label="Use saved template"
              checked={draft.useSavedTemplate}
              onChange={(_event, data) =>
                setDraft((current) => ({
                  ...current,
                  useSavedTemplate: data.checked === true
                }))
              }
            />
            <Checkbox
              label="Save template"
              checked={draft.saveTemplate}
              onChange={(_event, data) =>
                setDraft((current) => ({
                  ...current,
                  saveTemplate: data.checked === true
                }))
              }
            />
          </div>
        </Card>
      ) : null}

      {currentStep === "preview" ? (
        <Card>
          <Title3>Step 4: Preview</Title3>
          <Button appearance="primary" disabled={busy} onClick={() => void onRunPreview()}>
            {busy ? "Previewing..." : "Run preview"}
          </Button>

          {draft.previewResult ? (
            <>
              <div className="import-summary-grid">
                <Badge appearance="filled" color="success">
                  {`Accepted: ${draft.previewResult.acceptedCount}`}
                </Badge>
                <Badge appearance="filled" color="danger">
                  {`Rejected: ${draft.previewResult.rejectedCount}`}
                </Badge>
                <Badge appearance="filled" color="warning">
                  {`Duplicates: ${draft.previewResult.duplicateCount}`}
                </Badge>
              </div>
              <Text>{`Dedupe policy: deterministic fingerprint keeps earliest row and skips subsequent duplicates.`}</Text>

              <Table aria-label="Import preview rows">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Row</TableHeaderCell>
                    <TableHeaderCell>Name</TableHeaderCell>
                    <TableHeaderCell>Amount</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row) => (
                    <TableRow key={`${row.rowNumber}-${row.name}`}>
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.amount}</TableCell>
                      <TableCell>{row.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Card>
                <Title3>Error review</Title3>
                <Select
                  aria-label="Error filter"
                  value={errorFilter}
                  onChange={(event) =>
                    setErrorFilter(event.target.value as ImportErrorFilter)
                  }
                >
                  <option value="all">All errors</option>
                  <option value="validation">Validation</option>
                  <option value="duplicate">Duplicate</option>
                </Select>
                {filteredErrors.length === 0 ? (
                  <Text>No errors match selected filter.</Text>
                ) : (
                  <ul className="import-error-list">
                    {filteredErrors.map((entry) => (
                      <li key={`${entry.rowNumber}-${entry.code}-${entry.field}`}>
                        <Text>{`Row ${entry.rowNumber} (${entry.code}) ${entry.field}: ${entry.message}`}</Text>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <Title3>Optional tagging suggestions</Title3>
                <Text>{`${selectedSuggestionCount} suggestion(s) selected.`}</Text>
                <ul className="import-suggestion-list">
                  {tagSuggestions.map((entry) => (
                    <li key={entry.id}>
                      <Checkbox
                        label={entry.label}
                        checked={entry.selected}
                        onChange={(_event, data) =>
                          toggleSuggestion(entry.id, data.checked === true)
                        }
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          ) : null}
        </Card>
      ) : null}

      {currentStep === "commit" ? (
        <Card>
          <Title3>Step 5: Commit</Title3>
          <Button
            appearance="primary"
            disabled={busy || draft.previewResult === null}
            onClick={() => void onRunCommit()}
          >
            {busy ? "Committing..." : "Commit import"}
          </Button>

          {draft.commitResult ? (
            <div className="import-commit-summary" data-testid="import-commit-summary">
              <Text>{`Accepted: ${draft.commitResult.acceptedCount}`}</Text>
              <Text>{`Rejected: ${draft.commitResult.rejectedCount}`}</Text>
              <Text>{`Duplicates: ${draft.commitResult.duplicateCount}`}</Text>
              <Text>{`Inserted: ${draft.commitResult.insertedCount}`}</Text>
              {draft.mode === "actuals" ? (
                <>
                  <Text>{`Matched: ${draft.commitResult.matchedCount ?? 0}`}</Text>
                  <Text>{`Unmatched: ${draft.commitResult.unmatchedCount ?? 0}`}</Text>
                  <Text>{`Match rate: ${((draft.commitResult.matchRate ?? 0) * 100).toFixed(1)}%`}</Text>
                  <Card>
                    <Title3>Unmatched actuals queue</Title3>
                    {draft.commitResult.unmatchedForReview?.length ? (
                      <ul className="import-unmatched-list">
                        {draft.commitResult.unmatchedForReview.map((entry) => (
                          <li key={entry.id}>
                            <Text>{`${entry.transactionDate} • $${(entry.amountMinor / 100).toFixed(2)} • ${
                              entry.description ?? "No description"
                            }`}</Text>
                            <Button size="small" appearance="secondary">
                              Queue follow-up
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Text>No unmatched rows.</Text>
                    )}
                  </Card>
                </>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      {pageError ? <InlineError message={pageError} /> : null}
      {pageMessage ? <Text>{pageMessage}</Text> : null}

      <div className="import-nav">
        <Button
          appearance="secondary"
          disabled={currentStep === "mode" || busy}
          onClick={onBack}
        >
          Back
        </Button>
        <Button
          appearance="primary"
          disabled={currentStep === "commit" || busy}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </section>
  );
}

