import { describe, expect, it } from "vitest";

import { budgetItThemes } from "./theme";

describe("BudgetIT theme tokens", () => {
  it("keeps expected base typography and radius tokens", () => {
    expect(budgetItThemes.light.fontFamilyBase).toContain("Roboto");
    expect(budgetItThemes.light.fontFamilyMonospace).toContain("JetBrains Mono");
    expect(budgetItThemes.light.borderRadiusMedium).toBe("8px");
    expect(budgetItThemes.light.borderRadiusLarge).toBe("12px");
  });

  it("exports light, dark, and high-contrast themes", () => {
    expect(Object.keys(budgetItThemes)).toEqual([
      "light",
      "dark",
      "highContrast"
    ]);
  });
});
