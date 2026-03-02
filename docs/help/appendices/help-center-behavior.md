## Help Center Behavior (Current Implementation)
BudgetIT Help is route-driven and topic-based. The Help window/page renders content from this document based on topic mapping.

### Launch points
- Top-bar **Help** button opens Help Center.
- Desktop menu **Help > Help Center** opens `quick-start`.
- Desktop menu **Help > Keyboard Shortcuts** opens `global-keyboard-shortcuts`.
- `F1` opens Help Center.

### Topic selector and query parameters
- Base route: `/help`
- `topic` query parameter selects a help topic ID (example: `dashboard-overview`).
- `anchor` query parameter scrolls to a heading within the rendered topic section.
- `q` query parameter seeds the Help search index input.
- `context` query parameter carries source-page context text for operator orientation.
- If `topic` is missing/invalid, Help defaults to `quick-start`.
- Topic dropdown options are grouped by journey step (Orientation, Setup, Import, Analysis, Reporting, Operations).
- Changing the Help topic dropdown updates `topic`, clears `anchor`, and re-renders content.
- When search input changes, Help updates `q` in the URL for reproducible deep links.

### Section extraction and fallback behavior
- Each Help topic maps to a `docSection` heading in this file.
- Help renders from matching `## <docSection>` until the next `##` heading.
- If a mapped heading is missing, Help shows the full document and a fallback note.

### Anchor behavior
- `anchor` supports direct scroll to matching heading IDs in rendered markdown.
- Anchor matching uses normalized heading IDs (lowercase, punctuation removed, spaces converted to `-`).

### Current scope note
- Inline contextual `(?)` popups are not currently shipped in the renderer.
- In-product help is delivered through the dedicated Help route/window and topic selection.
