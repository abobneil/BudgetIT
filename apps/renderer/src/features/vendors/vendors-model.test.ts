import { describe, expect, it } from "vitest";

import { INITIAL_VENDOR_RECORDS } from "./vendor-data";
import { evaluateVendorGuards, isDuplicateVendorName } from "./vendors-model";

describe("vendors model", () => {
  it("detects duplicate vendor names with case-insensitive normalization", () => {
    expect(isDuplicateVendorName("okta", INITIAL_VENDOR_RECORDS)).toBe(true);
    expect(isDuplicateVendorName("  AWS  ", INITIAL_VENDOR_RECORDS)).toBe(true);
    expect(
      isDuplicateVendorName("okta", INITIAL_VENDOR_RECORDS, "vend-okta")
    ).toBe(false);
    expect(isDuplicateVendorName("New Vendor", INITIAL_VENDOR_RECORDS)).toBe(false);
  });

  it("applies archive/delete guard rules from dependency state", () => {
    const activeWithDependencies = evaluateVendorGuards(INITIAL_VENDOR_RECORDS[0]);
    expect(activeWithDependencies.canArchive).toBe(true);
    expect(activeWithDependencies.canDelete).toBe(false);
    expect(activeWithDependencies.deleteReason).toMatch(/Cannot delete vendor/i);

    const archivedRecord = evaluateVendorGuards({
      ...INITIAL_VENDOR_RECORDS[0],
      status: "archived",
      linkedServiceIds: [],
      linkedContractIds: []
    });
    expect(archivedRecord.canArchive).toBe(false);
    expect(archivedRecord.archiveReason).toMatch(/already archived/i);
    expect(archivedRecord.canDelete).toBe(true);
  });
});
