export type VendorStatus = "active" | "watch" | "archived";
export type VendorRisk = "low" | "medium" | "high";

export type VendorRecord = {
  id: string;
  name: string;
  owner: string;
  annualSpendMinor: number;
  status: VendorStatus;
  risk: VendorRisk;
  linkedServiceIds: string[];
  linkedContractIds: string[];
};

export const INITIAL_VENDOR_RECORDS: VendorRecord[] = [
  {
    id: "vend-okta",
    name: "Okta",
    owner: "IT Operations",
    annualSpendMinor: 1820000,
    status: "active",
    risk: "high",
    linkedServiceIds: ["svc-identity-sso"],
    linkedContractIds: ["ctr-sso-main", "ctr-sso-addon"]
  },
  {
    id: "vend-aws",
    name: "AWS",
    owner: "Platform Engineering",
    annualSpendMinor: 5240000,
    status: "active",
    risk: "medium",
    linkedServiceIds: ["svc-cloud-platform"],
    linkedContractIds: ["ctr-cloud-ops"]
  },
  {
    id: "vend-msft",
    name: "Microsoft",
    owner: "Security Team",
    annualSpendMinor: 1310000,
    status: "watch",
    risk: "high",
    linkedServiceIds: ["svc-endpoint-security"],
    linkedContractIds: []
  },
  {
    id: "vend-datadog",
    name: "Datadog",
    owner: "Platform Engineering",
    annualSpendMinor: 860000,
    status: "active",
    risk: "medium",
    linkedServiceIds: [],
    linkedContractIds: ["ctr-observability"]
  },
  {
    id: "vend-unused",
    name: "Unused Supplier",
    owner: "Finance Ops",
    annualSpendMinor: 0,
    status: "watch",
    risk: "low",
    linkedServiceIds: [],
    linkedContractIds: []
  }
];
