const KNOWN_ACRONYMS = new Set([
  "NLQ",
  "CSV",
  "PDF",
  "HTML",
  "XLSX",
  "IPC"
]);

export function humanizeTokenLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleWord(word: string): string {
  if (!word) {
    return "";
  }

  const upper = word.toUpperCase();
  if (KNOWN_ACRONYMS.has(upper)) {
    return upper;
  }

  const digitWordMatch = word.match(/^(\d+)([a-zA-Z]+)$/);
  if (digitWordMatch) {
    return `${digitWordMatch[1]}${digitWordMatch[2].toUpperCase()}`;
  }

  if (/^\d+$/.test(word)) {
    return word;
  }

  return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
}

export function toTitleCaseLabel(value: string): string {
  const humanized = humanizeTokenLabel(value);
  if (!humanized) {
    return "";
  }

  return humanized
    .split(" ")
    .map((token) => token.split("/").map(toTitleWord).join("/"))
    .join(" ");
}
