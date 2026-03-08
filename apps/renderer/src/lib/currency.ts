import { useEffect, useState } from "react";

import { getScenarioSettings, isIpcAvailable } from "./ipcClient";

const ISO_4217_CURRENCY_CODE = /^[A-Z]{3}$/;
const formatterCache = new Map<string, Intl.NumberFormat>();
const decimalFormatterCache = new Map<string, Intl.NumberFormat>();
const numberSymbolsCache = new Map<
  string,
  { decimal: string; group: string; minusSign: string }
>();

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

function getPreferredLocale(): string | undefined {
  if (typeof navigator === "undefined") {
    return undefined;
  }
  return navigator.languages?.find(Boolean) ?? navigator.language;
}

function getCacheKey(currency: string, locale: string | undefined): string {
  return `${locale ?? "default"}:${currency}`;
}

function getFormatter(currency: string, locale: string | undefined = getPreferredLocale()): Intl.NumberFormat {
  const cacheKey = getCacheKey(currency, locale);
  const existing = formatterCache.get(cacheKey);
  if (existing) {
    return existing;
  }
  const created = new Intl.NumberFormat(locale, {
    style: "currency",
    currency
  });
  formatterCache.set(cacheKey, created);
  return created;
}

function getCurrencyFractionDigits(
  currency: string,
  locale: string | undefined = getPreferredLocale()
): number {
  return getFormatter(currency, locale).resolvedOptions().maximumFractionDigits ?? 2;
}

function getCurrencyMinorUnitFactor(
  currency: string,
  locale: string | undefined = getPreferredLocale()
): number {
  return 10 ** getCurrencyFractionDigits(currency, locale);
}

function getDecimalFormatter(
  currency: string,
  locale: string | undefined = getPreferredLocale()
): Intl.NumberFormat {
  const cacheKey = getCacheKey(currency, locale);
  const existing = decimalFormatterCache.get(cacheKey);
  if (existing) {
    return existing;
  }
  const digits = getCurrencyFractionDigits(currency, locale);
  const created = new Intl.NumberFormat(locale, {
    style: "decimal",
    useGrouping: false,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
  decimalFormatterCache.set(cacheKey, created);
  return created;
}

function getNumberSymbols(
  locale: string | undefined = getPreferredLocale()
): { decimal: string; group: string; minusSign: string } {
  const cacheKey = locale ?? "default";
  const existing = numberSymbolsCache.get(cacheKey);
  if (existing) {
    return existing;
  }
  const parts = new Intl.NumberFormat(locale, {
    style: "decimal",
    useGrouping: true
  }).formatToParts(-12345.6);
  const resolved = {
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
    group: parts.find((part) => part.type === "group")?.value ?? ",",
    minusSign: parts.find((part) => part.type === "minusSign")?.value ?? "-"
  };
  numberSymbolsCache.set(cacheKey, resolved);
  return resolved;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  const minorUnitFactor = getCurrencyMinorUnitFactor(displayCurrency);
  return getFormatter(displayCurrency).format(amountMinor / minorUnitFactor);
}

export function formatCurrencyInputMinor(
  amountMinor: number,
  currency: string | null | undefined,
  fallbackCurrency: string = "USD"
): string {
  const displayCurrency = resolveDisplayCurrency(currency, fallbackCurrency);
  const minorUnitFactor = getCurrencyMinorUnitFactor(displayCurrency);
  return getDecimalFormatter(displayCurrency).format(amountMinor / minorUnitFactor);
}

export function parseCurrencyInputToMinor(
  value: string,
  currency: string | null | undefined,
  fallbackCurrency: string = "USD"
): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const displayCurrency = resolveDisplayCurrency(currency, fallbackCurrency);
  const locale = getPreferredLocale();
  const { decimal, group, minusSign } = getNumberSymbols(locale);
  const fractionDigits = getCurrencyFractionDigits(displayCurrency, locale);

  let normalized = trimmed.replace(/\s+/g, "");
  if (group) {
    normalized = normalized.replace(new RegExp(escapeRegExp(group), "g"), "");
  }
  if (decimal && decimal !== ".") {
    normalized = normalized.replace(new RegExp(escapeRegExp(decimal), "g"), ".");
  }
  if (minusSign && minusSign !== "-") {
    normalized = normalized.replace(new RegExp(escapeRegExp(minusSign), "g"), "-");
  }
  normalized = normalized.replace(/[^0-9.-]/g, "");

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const [, fractional = ""] = normalized.split(".");
  if (fractional.length > fractionDigits) {
    return null;
  }

  const amountMajor = Number(normalized);
  if (!Number.isFinite(amountMajor)) {
    return null;
  }

  const minorUnitFactor = getCurrencyMinorUnitFactor(displayCurrency, locale);
  return Math.round(amountMajor * minorUnitFactor);
}

export function buildCurrencyInputExample(
  currency: string | null | undefined,
  fallbackCurrency: string = "USD",
  amountMajor: number = 500
): { input: string; formatted: string } {
  const displayCurrency = resolveDisplayCurrency(currency, fallbackCurrency);
  const minorUnitFactor = getCurrencyMinorUnitFactor(displayCurrency);
  const amountMinor = Math.round(amountMajor * minorUnitFactor);
  return {
    input: formatCurrencyInputMinor(amountMinor, displayCurrency, fallbackCurrency),
    formatted: formatCurrencyMinor(amountMinor, displayCurrency, fallbackCurrency)
  };
}

export function useScenarioCurrency(
  scenarioId: string,
  fallbackCurrency: string = "USD"
): string {
  const [currency, setCurrency] = useState(resolveDisplayCurrency(undefined, fallbackCurrency));

  useEffect(() => {
    let cancelled = false;
    const nextFallback = resolveDisplayCurrency(undefined, fallbackCurrency);

    if (!isIpcAvailable()) {
      setCurrency(nextFallback);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const settings = await getScenarioSettings({ scenarioId });
        if (!cancelled) {
          setCurrency(resolveDisplayCurrency(settings.defaultCurrency, nextFallback));
        }
      } catch {
        if (!cancelled) {
          setCurrency(nextFallback);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fallbackCurrency, scenarioId]);

  return currency;
}
