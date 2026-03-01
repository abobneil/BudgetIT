const ISO_4217_CURRENCY_CODE = /^[A-Z]{3}$/;
const formatterCache = new Map<string, Intl.NumberFormat>();

function normalizeCurrencyCode(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  if (normalized.length === 0 || normalized === "MIXED") {
    return null;
  }
  return ISO_4217_CURRENCY_CODE.test(normalized) ? normalized : null;
}

function getFormatter(currency: string): Intl.NumberFormat {
  const existing = formatterCache.get(currency);
  if (existing) {
    return existing;
  }
  const created = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  });
  formatterCache.set(currency, created);
  return created;
}

export function resolveDisplayCurrency(
  currency: string | null | undefined,
  fallbackCurrency: string = "USD"
): string {
  const fallback = normalizeCurrencyCode(fallbackCurrency) ?? "USD";
  return normalizeCurrencyCode(currency) ?? fallback;
}

export function formatCurrencyMinor(
  amountMinor: number,
  currency: string | null | undefined,
  fallbackCurrency: string = "USD"
): string {
  const displayCurrency = resolveDisplayCurrency(currency, fallbackCurrency);
  return getFormatter(displayCurrency).format(amountMinor / 100);
}
