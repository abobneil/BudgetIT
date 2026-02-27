export type VendorFilterOption = {
  value: string;
  label: string;
};

export function buildVendorFilterOptions(
  records: Array<{ vendorId: string; vendorName: string }>
): VendorFilterOption[] {
  const deduped = new Map<string, string>();
  for (const record of records) {
    if (!record.vendorId) {
      continue;
    }
    if (!deduped.has(record.vendorId)) {
      deduped.set(record.vendorId, record.vendorName);
    }
  }

  return Array.from(deduped.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function matchesVendorFilter(
  selectedVendorId: string,
  recordVendorId: string
): boolean {
  if (selectedVendorId === "all") {
    return true;
  }
  return selectedVendorId === recordVendorId;
}
