export type RecurrenceFrequency = "monthly" | "quarterly" | "yearly";

export type RecurrencePreviewRule = {
  frequency: RecurrenceFrequency;
  interval: number;
  dayOfMonth: number;
  anchorDate: string;
};

function parseIsoDate(isoDate: string): { year: number; month: number; day: number } {
  const [year, month, day] = isoDate
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  return {
    year,
    month,
    day
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

function monthStep(frequency: RecurrenceFrequency): number {
  if (frequency === "quarterly") {
    return 3;
  }
  if (frequency === "yearly") {
    return 12;
  }
  return 1;
}

function compareIsoDates(left: string, right: string): number {
  return left.localeCompare(right);
}

function clampDayOfMonth(year: number, month: number, dayOfMonth: number): number {
  return Math.min(dayOfMonth, daysInMonth(year, month));
}

export function generateRecurrencePreview(
  rule: RecurrencePreviewRule,
  count: number = 12,
  fromIsoDate: string = new Date().toISOString().slice(0, 10)
): string[] {
  if (count <= 0) {
    return [];
  }

  const intervalMonths = Math.max(rule.interval, 1) * monthStep(rule.frequency);
  const anchor = parseIsoDate(rule.anchorDate);
  const startMonthIndex = anchor.year * 12 + (anchor.month - 1);
  const occurrences: string[] = [];

  for (let index = 0; occurrences.length < count && index < 240; index += 1) {
    const monthIndex = startMonthIndex + index * intervalMonths;
    const year = Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    const day = clampDayOfMonth(year, month, Math.max(rule.dayOfMonth, 1));
    const occurrence = toIsoDate(year, month, day);
    if (compareIsoDates(occurrence, fromIsoDate) >= 0) {
      occurrences.push(occurrence);
    }
  }

  return occurrences;
}
