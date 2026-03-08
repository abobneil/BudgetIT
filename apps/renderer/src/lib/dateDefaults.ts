export function toUtcIsoDate(value: Date = new Date()): string {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export function currentYearDateRange(value: Date = new Date()): {
  dateFrom: string;
  dateTo: string;
} {
  const year = value.getUTCFullYear();
  return {
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`
  };
}

export function currentMonthDateRange(value: Date = new Date()): {
  dateFrom: string;
  dateTo: string;
} {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const monthText = String(month + 1).padStart(2, "0");
  return {
    dateFrom: `${year}-${monthText}-01`,
    dateTo: `${year}-${monthText}-${String(lastDay).padStart(2, "0")}`
  };
}
