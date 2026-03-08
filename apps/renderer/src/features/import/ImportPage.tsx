import { useEffect, useMemo, useState } from "react";
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

import {
  commitImport,
  deleteImportTemplate,
  isIpcAvailable,
  listImportTemplates,
  pickFilePath,
  previewImport,
  type ImportTemplateSummary
} from "../../lib/ipcClient";
import { buildHelpHashPath } from "../help/help-topics";
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
import { useFeedback } from "../../ui/feedback";
import { useNavigate } from "react-router-dom";
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
  const hasIpc = isIpcAvailable();
  const { notify } = useFeedback();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => createInitialImportWizardDraft());
  const [currentStep, setCurrentStep] = useState<ImportWizardStep>("mode");
  const [errorFilter, setErrorFilter] = useState<ImportErrorFilter>("all");
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<ImportTemplateSummary[]>([]);
  const [templateLibraryLoading, setTemplateLibraryLoading] = useState(false);
  const [templateLibraryBusy, setTemplateLibraryBusy] = useState<string | null>(null);
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
  const currentStepIndex = IMPORT_WIZARD_STEPS.indexOf(currentStep);

  async function loadTemplateLibrary(): Promise<void> {
    if (!hasIpc) {
      return;
    }
    setTemplateLibraryLoading(true);
    try {
      const result = await listImportTemplates();
      setSavedTemplates(result.templates);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      notify({
        tone: "warning",
        message: `Template library load failed: ${detail}`
      });
    } finally {
      setTemplateLibraryLoading(false);
    }
  }

  useEffect(() => {
    void loadTemplateLibrary();
  }, []);

  async function browseImportFile(): Promise<void> {
    const picked = await pickFilePath({
      title: "Select import file",
      defaultPath: draft.filePath || undefined,
      filters: [
        { name: "Import files", extensions: ["csv", "xlsx", "xls"] },
        { name: "All files", extensions: ["*"] }
      ]
    });
    if (!picked) {
      return;
    }
    setDraft((current) => ({ ...current, filePath: picked }));
  }

  function onNext(): void {
    if (!canAdvanceStep(currentStep, draft)) {
      if (currentStep === "file") {
        const message = "Choose a file path before moving to mapping.";
        setPageError(message);
        notify({ tone: "warning", message });
      } else if (currentStep === "preview") {
        const message = "Run preview before moving to commit.";
        setPageError(message);
        notify({ tone: "warning", message });
      } else {
        const message = "Complete required fields before moving to next step.";
        setPageError(message);
        notify({ tone: "warning", message });
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
    try {
      const result = await previewImport(buildImportPayload(draft));
      setDraft((current) => ({ ...current, previewResult: result, commitResult: null }));
      if (result.templateSaved) {
        await loadTemplateLibrary();
      }
      notify({
        tone: "success",
        message: `Preview loaded: ${result.acceptedCount} accepted, ${result.rejectedCount} rejected, ${result.duplicateCount} duplicates.`
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Preview failed: ${detail}`;
      setPageError(message);
      notify({ tone: "error", message });
    } finally {
      setBusy(false);
    }
  }

  async function onRunCommit(): Promise<void> {
    setBusy(true);
    setPageError(null);
    try {
      const result = await commitImport(buildImportPayload(draft));
      setDraft((current) => ({ ...current, commitResult: result }));
      await loadTemplateLibrary();
      notify({
        tone: "success",
        message: `Commit completed: ${result.insertedCount} inserted, ${result.rejectedCount} rejected, ${result.duplicateCount} duplicates.`
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Commit failed: ${detail}`;
      setPageError(message);
      notify({ tone: "error", message });
    } finally {
      setBusy(false);
    }
  }

  function toggleSuggestion(id: string, checked: boolean): void {
    setTagSuggestions((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, selected: checked } : entry))
    );
  }

  async function handleDeleteTemplate(name: string): Promise<void> {
    if (!hasIpc) {
      return;
    }
    setTemplateLibraryBusy(name);
    try {
      const result = await deleteImportTemplate(name);
      if (result.deleted) {
        notify({ tone: "success", message: `Template ${name} deleted.` });
      } else {
        notify({ tone: "info", message: `Template ${name} was already absent.` });
      }
      if (draft.templateName === name) {
        setDraft((current) => ({
          ...current,
          templateName: "",
          useSavedTemplate: false
        }));
      }
      await loadTemplateLibrary();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      notify({ tone: "error", message: `Template delete failed: ${detail}` });
    } finally {
      setTemplateLibraryBusy(null);
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

  return (
    <section className="import-page">
      <PageHeader
        title="Import Wizard"
        subtitle="Guided stepper for mode, mapping, preview, and commit with deterministic dedupe outcomes."
        actions={(
          <div className="import-nav">
            <Button
              appearance="secondary"
              size="small"
              type="button"
              onClick={() =>
                openHelpTopic("import-wizard", "5-steps", "import workflow", "import:wizard")
              }
            >
              Import Guide
            </Button>
            <Button
              appearance="secondary"
              size="small"
              type="button"
              onClick={() =>
                openHelpTopic(
                  "reports-workspace",
                  "unmatched-actuals-review",
                  "unmatched actuals",
                  "import:reconciliation"
                )
              }
            >
              Reconciliation Guide
            </Button>
          </div>
        )}
      />

      <Card data-testid="import-definitions-card">
        <Title3>Field & Status Definitions</Title3>
        <ul className="import-definitions-list">
          <li>
            <Text>
              <strong>Accepted</strong>: row passed validation and is eligible for commit.
            </Text>
          </li>
          <li>
            <Text>
              <strong>Rejected</strong>: row failed validation and is excluded from commit.
            </Text>
          </li>
          <li>
            <Text>
              <strong>Duplicate</strong>: row fingerprint matched an earlier row in this run.
            </Text>
          </li>
          <li>
            <Text>
              <strong>Matched / Unmatched</strong>: actuals linked or pending reconciliation.
            </Text>
          </li>
        </ul>
        <div className="import-nav">
          <Button
            appearance="secondary"
            size="small"
            type="button"
            onClick={() =>
              openHelpTopic(
                "import-wizard",
                "glossary-import-statuses-and-match-outcomes",
                "import statuses",
                "import:definitions"
              )
            }
          >
            Open Full Definitions
          </Button>
        </div>
      </Card>

      <Card>
        <ol className="import-stepper">
          {IMPORT_WIZARD_STEPS.map((step, index) => (
            <li
              key={step}
              className={
                index < currentStepIndex
                  ? "import-stepper__item import-stepper__item--complete"
                  : step === currentStep
                    ? "import-stepper__item import-stepper__item--active"
                    : "import-stepper__item"
              }
              data-testid={`import-step-${step}`}
              aria-current={step === currentStep ? "step" : undefined}
            >
              <span className="import-stepper__index">{index + 1}</span>
              <span className="import-stepper__label">{stepLabel(step)}</span>
            </li>
          ))}
        </ol>
      </Card>

      {currentStep === "mode" ? (
        <Card>
          <Title3>Step 1: Select import mode</Title3>
          <div className="import-step-form">
            <div className="import-step-form__field">
              <Text className="import-step-form__label" size={200} weight="medium">
                Import mode
              </Text>
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
              <Text className="import-step-form__hint" size={100}>
                {draft.mode === "expenses"
                  ? "Use for planned/committed expense lines."
                  : "Use for observed transactions matched against expenses."}
              </Text>
            </div>
          </div>
        </Card>
      ) : null}

      {currentStep === "file" ? (
        <Card>
          <Title3>Step 2: Select file</Title3>
          <div className="import-step-form">
            <div className="import-step-form__field">
              <Text className="import-step-form__label" size={200} weight="medium">
                Source file path
              </Text>
              <div className="import-nav">
                <Input
                  aria-label="Import file path"
                  value={draft.filePath}
                  onChange={(_event, data) =>
                    setDraft((current) => ({ ...current, filePath: data.value }))
                  }
                  placeholder="C:\\imports\\budget.xlsx"
                />
                <Button
                  appearance="secondary"
                  disabled={!hasIpc}
                  onClick={() => void browseImportFile()}
                >
                  Browse…
                </Button>
              </div>
              <Text className="import-step-form__hint" size={100}>
                Supports CSV and spreadsheet sources accepted by the backend importer.
              </Text>
            </div>
          </div>
        </Card>
      ) : null}

      {currentStep === "mapping" ? (
        <Card>
          <Title3>Step 3: Mapping template</Title3>
          <div className="import-step-form">
            <div className="import-step-form__field">
              <Text className="import-step-form__label" size={200} weight="medium">
                Mapping template name
              </Text>
              <Input
                aria-label="Mapping template"
                value={draft.templateName}
                onChange={(_event, data) =>
                  setDraft((current) => ({ ...current, templateName: data.value }))
                }
                placeholder="default-expense-import"
              />
              <Text className="import-step-form__hint" size={100}>
                Keep a consistent name to reuse mapping profiles across imports.
              </Text>
            </div>
            <div className="import-step-form__field">
              <Text className="import-step-form__label" size={200} weight="medium">
                Cloud template pack
              </Text>
              <Select
                aria-label="Cloud template pack"
                value={draft.templatePack}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    templatePack: event.target.value as
                      | ""
                      | "aws-cur"
                      | "azure-cost"
                      | "gcp-billing"
                  }))
                }
              >
                <option value="">No Pack</option>
                <option value="aws-cur">AWS CUR CSV</option>
                <option value="azure-cost">Azure cost export CSV</option>
                <option value="gcp-billing">GCP billing export CSV</option>
              </Select>
            </div>
            <div className="import-flags">
              <Checkbox
                label="Use Saved Template"
                checked={draft.useSavedTemplate}
                onChange={(_event, data) =>
                  setDraft((current) => ({
                    ...current,
                    useSavedTemplate: data.checked === true
                  }))
                }
              />
              <Checkbox
                label="Save Template"
                checked={draft.saveTemplate}
                onChange={(_event, data) =>
                  setDraft((current) => ({
                    ...current,
                    saveTemplate: data.checked === true
                  }))
                }
              />
              <Checkbox
                label="Enforce Finance Metadata"
                checked={draft.requireFinanceMetadata}
                onChange={(_event, data) =>
                  setDraft((current) => ({
                    ...current,
                    requireFinanceMetadata: data.checked === true
                  }))
                }
              />
            </div>
            <Card>
              <Title3>Template library</Title3>
              <div className="import-step-form__field">
                <Text className="import-step-form__hint" size={100}>
                  Reuse or retire saved mappings. Versions increment on each save.
                </Text>
                <div className="import-nav">
                  <Button
                    appearance="secondary"
                    disabled={!hasIpc || templateLibraryLoading || templateLibraryBusy !== null}
                    onClick={() => void loadTemplateLibrary()}
                  >
                    {templateLibraryLoading ? "Refreshing..." : "Refresh Templates"}
                  </Button>
                </div>
                {!hasIpc ? (
                  <Text>Template library unavailable without desktop IPC.</Text>
                ) : savedTemplates.length === 0 ? (
                  <Text>No saved templates.</Text>
                ) : (
                  <Table aria-label="Template library table">
                    <TableHeader>
                      <TableRow>
                        <TableHeaderCell>Name</TableHeaderCell>
                        <TableHeaderCell>Version</TableHeaderCell>
                        <TableHeaderCell>Updated</TableHeaderCell>
                        <TableHeaderCell>Actions</TableHeaderCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savedTemplates.map((entry) => (
                        <TableRow key={entry.name}>
                          <TableCell>{entry.name}</TableCell>
                          <TableCell>{entry.templateVersion}</TableCell>
                          <TableCell>{new Date(entry.updatedAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="import-nav">
                              <Button
                                size="small"
                                appearance="secondary"
                                onClick={() =>
                                  setDraft((current) => ({
                                    ...current,
                                    templateName: entry.name,
                                    useSavedTemplate: true
                                  }))
                                }
                              >
                                Use Template
                              </Button>
                              <Button
                                size="small"
                                appearance="secondary"
                                disabled={templateLibraryBusy !== null}
                                onClick={() => void handleDeleteTemplate(entry.name)}
                              >
                                {templateLibraryBusy === entry.name ? "Deleting..." : "Delete"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </Card>
          </div>
        </Card>
      ) : null}

      {currentStep === "preview" ? (
        <Card>
          <Title3>Step 4: Preview</Title3>
          <Button appearance="primary" disabled={busy} onClick={() => void onRunPreview()}>
            {busy ? "Previewing..." : "Run Preview"}
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
            {busy ? "Committing..." : "Commit Import"}
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
                            <Text>{`${entry.transactionDate} | $${(entry.amountMinor / 100).toFixed(2)} | ${
                              entry.description ?? "No description"
                            }`}</Text>
                            <Button size="small" appearance="secondary">
                              Queue Follow-Up
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

