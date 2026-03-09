import {
  teamsHighContrastTheme,
  webDarkTheme,
  webLightTheme,
  type Theme
} from "@fluentui/react-components";

const WINDOW_SHADOW_LIGHT = "0 2px 6px rgba(0,0,0,0.12), 0 18px 40px rgba(0,0,0,0.18)";
const WINDOW_SHADOW_DARK = "0 2px 8px rgba(0,0,0,0.28), 0 18px 40px rgba(0,0,0,0.36)";
const WINDOW_SHADOW_HIGH_CONTRAST =
  "0 0 0 1px rgba(255,255,255,0.9), 0 12px 28px rgba(0,0,0,0.55)";

function withBudgetItTokens(theme: Theme): Theme {
  return {
    ...theme,
    fontFamilyBase: '"Roboto", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    fontFamilyMonospace: '"JetBrains Mono", "Consolas", "Cascadia Mono", "Courier New", monospace',
    borderRadiusMedium: "8px",
    borderRadiusLarge: "12px"
  };
}

export const budgetItLightTheme = withBudgetItTokens({
  ...webLightTheme,
  shadow64: WINDOW_SHADOW_LIGHT
});
export const budgetItDarkTheme = withBudgetItTokens({
  ...webDarkTheme,
  shadow64: WINDOW_SHADOW_DARK
});
export const budgetItHighContrastTheme = withBudgetItTokens({
  ...teamsHighContrastTheme,
  shadow64: WINDOW_SHADOW_HIGH_CONTRAST
});

export const budgetItThemes = {
  light: budgetItLightTheme,
  dark: budgetItDarkTheme,
  highContrast: budgetItHighContrastTheme
} as const;
