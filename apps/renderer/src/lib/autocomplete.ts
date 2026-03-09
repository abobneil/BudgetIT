export function normalizeSuggestionValue(value: string): string {
  return value.trim().toLowerCase();
}

export function buildSuggestionList(values: Iterable<string>): string[] {
  const suggestionsByKey = new Map<string, string>();

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = normalizeSuggestionValue(trimmed);
    if (!suggestionsByKey.has(normalized)) {
      suggestionsByKey.set(normalized, trimmed);
    }
  }

  return [...suggestionsByKey.values()].sort((left, right) =>
    left.localeCompare(right)
  );
}
