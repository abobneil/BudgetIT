import { describe, expect, it } from "vitest";

import { budgetItThemes } from "./theme";

describe("BudgetIT theme tokens", () => {
  it("keeps expected base typography and radius tokens", () => {
    expect(budgetItThemes.light.fontFamilyBase).toContain("Roboto");
    expect(budgetItThemes.light.fontFamilyMonospace).toContain("JetBrains Mono");
    expect(budgetItThemes.light.borderRadiusMedium).toBe("8px");
    expect(budgetItThemes.light.borderRadiusLarge).toBe("12px");
  });

  it("uses a custom window shadow for dialog surfaces", () => {
    expect(budgetItThemes.light.shadow64).toBe(
      "0 2px 6px rgba(0,0,0,0.12), 0 18px 40px rgba(0,0,0,0.18)"
    );
    expect(budgetItThemes.dark.shadow64).toBe(
      "0 2px 8px rgba(0,0,0,0.28), 0 18px 40px rgba(0,0,0,0.36)"
    );
    expect(budgetItThemes.highContrast.shadow64).toBe(
      "0 0 0 1px rgba(255,255,255,0.9), 0 12px 28px rgba(0,0,0,0.55)"
    );
  });

  it("exports light, dark, and high-contrast themes", () => {
    expect(Object.keys(budgetItThemes)).toEqual([
      "light",
      "dark",
      "highContrast"
    ]);
  });
});
