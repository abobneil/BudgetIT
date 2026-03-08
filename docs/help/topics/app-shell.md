### Overview
Use App Shell controls from any page to switch context, jump quickly, and open help without breaking task flow.

### What it includes
- Left navigation sidebar for all workspaces.
- Top bar with:
  - Scenario selector
  - Global Search
  - Help button
- Keyboard command entry points:
  - Command Palette (`Ctrl+K`)
  - Global Search focus (`Ctrl+Shift+F`)
  - Help Center (`F1`)

### Control guidance
- Scenario selector:
  - Changes the active planning context used by dashboards, reports, and many workspace views.
  - If totals look wrong, check this first.
- Global Search:
  - Best for jumping to a known entity when you already know the name.
- Help button:
  - Opens contextual help for the current route.
- Command Palette:
  - Best for keyboard-first users who know the action or workspace they want.

### Start Here Paths
- New-user path:
  - Confirm the active scenario (usually `Baseline`).
  - Open Help (`F1`) and follow `Quick Start`.
  - Move through setup workspaces in sequence: Vendors -> Services -> Contracts -> Expenses -> Tags.
- Experienced-user path:
  - Open Command Palette (`Ctrl+K`) and jump directly to target route.
  - Use Help search with seeded context from page-level Help buttons.
  - Resolve the immediate task and return to workflow without route hunting.

### Why it matters
- Scenario selector controls data scope used by dashboards, reports, and operational queues.
- Global Search reduces navigation time when reviewing specific entities.
- Command Palette provides deterministic route/action access in keyboard-first workflows.
- Consistent help entry points reduce context switching when triaging issues.

### Common issues and fixes
- Wrong numbers on screen:
  - Re-check active Scenario first.
  - Confirm date/filter context in the current workspace.
- Keyboard command does not open expected UI:
  - Press `Escape` to clear modal focus.
  - Re-run `Ctrl+K` command.
- Help opened but landed on generic content:
  - Use topic dropdown and search index to refine.
  - Validate URL query (`topic`, `anchor`, optional `q`, `context`) if deep-linking.
