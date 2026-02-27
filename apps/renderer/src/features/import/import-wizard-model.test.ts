import { describe, expect, it } from "vitest";

import {
  buildImportPayload,
  canAdvanceStep,
  createInitialImportWizardDraft,
  nextStep,
  previousStep
} from "./import-wizard-model";

describe("import wizard model", () => {
  it("enforces guard conditions before advancing each step", () => {
    const initial = createInitialImportWizardDraft();
    expect(canAdvanceStep("mode", initial)).toBe(true);
    expect(canAdvanceStep("file", initial)).toBe(false);
    expect(canAdvanceStep("mapping", initial)).toBe(true);
    expect(canAdvanceStep("preview", initial)).toBe(false);
    expect(nextStep("file", initial)).toBe("file");
    expect(previousStep("mode")).toBe("mode");
  });

  it("supports deterministic step progression and payload generation", () => {
    const draft = createInitialImportWizardDraft();
    draft.mode = "actuals";
    draft.filePath = "C:\\imports\\actuals.xlsx";
    draft.templateName = "actuals-template";
    draft.previewResult = {
      totalRows: 5,
      acceptedCount: 4,
      rejectedCount: 1,
      duplicateCount: 1,
      templateApplied: "actuals-template",
      templateSaved: "actuals-template",
      errors: []
    };

    expect(nextStep("mode", draft)).toBe("file");
    expect(nextStep("file", draft)).toBe("mapping");
    expect(nextStep("mapping", draft)).toBe("preview");
    expect(nextStep("preview", draft)).toBe("commit");

    expect(buildImportPayload(draft)).toEqual({
      mode: "actuals",
      filePath: "C:\\imports\\actuals.xlsx",
      templateName: "actuals-template",
      useSavedTemplate: true,
      saveTemplate: true
    });
  });
});
