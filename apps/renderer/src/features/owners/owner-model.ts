import type { OwnerOptionRecord } from "../../lib/ipcClient";

export function normalizeOwnerName(value: string): string {
  return value.trim().toLowerCase();
}

export function toOwnerId(name: string): string {
  return `owner-${name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

type OwnerDirectorySeed = {
  ownerId?: string | null;
  owner?: string | null;
  ownerTeam?: string | null;
};

export function buildOwnerOptions(seed: {
  vendors?: OwnerDirectorySeed[];
  services?: OwnerDirectorySeed[];
  contracts?: OwnerDirectorySeed[];
}): OwnerOptionRecord[] {
  const byNormalizedName = new Map<string, OwnerOptionRecord>();

  const applySeed = (collection: OwnerDirectorySeed[] | undefined, field: "vendorCount" | "serviceCount" | "contractCount") => {
    for (const entry of collection ?? []) {
      const rawName = entry.owner ?? entry.ownerTeam ?? "";
      const name = rawName.trim();
      if (!name) {
        continue;
      }
      const normalizedName = normalizeOwnerName(name);
      const current =
        byNormalizedName.get(normalizedName) ??
        ({
          id: entry.ownerId ?? toOwnerId(name),
          name,
          archivedAt: null,
          createdAt: "",
          updatedAt: "",
          vendorCount: 0,
          serviceCount: 0,
          contractCount: 0
        } satisfies OwnerOptionRecord);
      current[field] += 1;
      byNormalizedName.set(normalizedName, current);
    }
  };

  applySeed(seed.vendors, "vendorCount");
  applySeed(seed.services, "serviceCount");
  applySeed(seed.contracts, "contractCount");

  return [...byNormalizedName.values()].sort((left, right) => left.name.localeCompare(right.name));
}
