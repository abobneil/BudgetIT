import {
  teamsHighContrastTheme,
  webDarkTheme,
  webLightTheme,
  type Theme
} from "@fluentui/react-components";

function withBudgetItTokens(theme: Theme): Theme {
  return {
    ...theme,
    fontFamilyBase: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    borderRadiusMedium: "8px",
    borderRadiusLarge: "12px"
  };
}

export const budgetItLightTheme = withBudgetItTokens(webLightTheme);
export const budgetItDarkTheme = withBudgetItTokens(webDarkTheme);
export const budgetItHighContrastTheme = withBudgetItTokens(
  teamsHighContrastTheme
);

export const budgetItThemes = {
  light: budgetItLightTheme,
  dark: budgetItDarkTheme,
  highContrast: budgetItHighContrastTheme
} as const;
