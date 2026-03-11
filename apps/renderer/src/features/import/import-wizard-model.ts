import type {
  ImportCommitResult,
  ImportPreviewResult,
  ImportRowError
} from "../../lib/ipcClient";

export type ImportWizardStep = "mode" | "file" | "mapping" | "preview" | "commit";
export type ImportErrorFilter = "all" | "validation" | "duplicate";

export const IMPORT_WIZARD_STEPS: ImportWizardStep[] = [
  "mode",
  "file",
  "mapping",
  "preview",
  "commit"
];

export type ImportWizardDraft = {
  mode: "baseline" | "expenses" | "actuals";
  filePath: string;
  templateName: string;
  templatePack: "" | "aws-cur" | "azure-cost" | "gcp-billing";
  useSavedTemplate: boolean;
  saveTemplate: boolean;
  requireFinanceMetadata: boolean;
  previewResult: ImportPreviewResult | null;
  commitResult: ImportCommitResult | null;
};

export function createInitialImportWizardDraft(): ImportWizardDraft {
  return {
    mode: "expenses",
    filePath: "",
    templateName: "default-expense-import",
    templatePack: "",
    useSavedTemplate: true,
    saveTemplate: true,
    requireFinanceMetadata: false,
    previewResult: null,
    commitResult: null
  };
}

export function canAdvanceStep(
  step: ImportWizardStep,
  draft: ImportWizardDraft
): boolean {
  if (step === "mode") {
    return true;
  }
  if (step === "file") {
    return draft.filePath.trim().length > 0;
  }
  if (step === "mapping") {
    if (draft.mode === "baseline") {
      return true;
    }
    return draft.templateName.trim().length > 0 || draft.templatePack.length > 0;
  }
  if (step === "preview") {
    return draft.previewResult !== null;
  }
  return false;
}

export function nextStep(
  step: ImportWizardStep,
  draft: ImportWizardDraft
): ImportWizardStep {
  if (!canAdvanceStep(step, draft)) {
    return step;
  }
  if (step === "mode") {
    return "file";
  }
  if (step === "file") {
    return "mapping";
  }
  if (step === "mapping") {
    return "preview";
  }
  if (step === "preview") {
    return "commit";
  }
  return "commit";
}

export function previousStep(step: ImportWizardStep): ImportWizardStep {
  if (step === "file") {
    return "mode";
  }
  if (step === "mapping") {
    return "file";
  }
  if (step === "preview") {
    return "mapping";
  }
  if (step === "commit") {
    return "preview";
  }
  return "mode";
}

export function buildImportPayload(draft: ImportWizardDraft): {
  mode: "baseline" | "expenses" | "actuals";
  filePath: string;
  templateName: string;
  templatePack?: "aws-cur" | "azure-cost" | "gcp-billing";
  useSavedTemplate: boolean;
  saveTemplate: boolean;
  requireFinanceMetadata: boolean;
} {
  return {
    mode: draft.mode,
    filePath: draft.filePath.trim(),
    templateName: draft.templateName.trim(),
    templatePack: draft.templatePack || undefined,
    useSavedTemplate: draft.useSavedTemplate,
    saveTemplate: draft.saveTemplate,
    requireFinanceMetadata: draft.requireFinanceMetadata
  };
}

export function filterImportErrors(
  errors: ImportRowError[],
  filter: ImportErrorFilter
): ImportRowError[] {
  if (filter === "all") {
    return errors;
  }
  return errors.filter((entry) => entry.code === filter);
}
