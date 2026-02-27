import type { VendorRecord } from "./vendor-data";

export type VendorGuardResult = {
  canArchive: boolean;
  canDelete: boolean;
  archiveReason: string | null;
  deleteReason: string | null;
};

export function normalizeVendorName(name: string): string {
  return name.trim().toLowerCase();
}

export function isDuplicateVendorName(
  candidateName: string,
  records: VendorRecord[],
  excludedVendorId?: string
): boolean {
  const normalizedCandidate = normalizeVendorName(candidateName);
  if (!normalizedCandidate) {
    return false;
  }
  return records.some((record) => {
    if (excludedVendorId && record.id === excludedVendorId) {
      return false;
    }
    return normalizeVendorName(record.name) === normalizedCandidate;
  });
}

export function evaluateVendorGuards(record: VendorRecord): VendorGuardResult {
  const dependencyCount =
    record.linkedServiceIds.length + record.linkedContractIds.length;

  const canArchive = record.status !== "archived";
  const canDelete = dependencyCount === 0;

  return {
    canArchive,
    canDelete,
    archiveReason: canArchive
      ? null
      : "Vendor is already archived.",
    deleteReason: canDelete
      ? null
      : "Cannot delete vendor while linked services or contracts exist."
  };
}
