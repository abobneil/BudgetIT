export type ServiceRisk = "low" | "medium" | "high";
export type ServiceReplacementStatus =
  | "not-started"
  | "candidate-review"
  | "approved";
export type ContractLifecycleStatus =
  | "active"
  | "renewal-window"
  | "notice-window"
  | "expired";

export type ServiceExpenseLine = {
  id: string;
  name: string;
  amountMinor: number;
  status: "planned" | "approved" | "committed" | "actual";
};

export type ServiceRecord = {
  id: string;
  vendorId: string;
  name: string;
  vendorName: string;
  owner: string;
  annualSpendMinor: number;
  renewalDate: string;
  risk: ServiceRisk;
  replacementStatus: ServiceReplacementStatus;
  linkedContractIds: string[];
  expenseLines: ServiceExpenseLine[];
};

export type ContractRecord = {
  id: string;
  vendorId: string;
  contractNumber: string;
  providerName: string;
  owner: string;
  startDate: string;
  endDate: string;
  renewalDate: string;
  noticeDeadline: string;
  lifecycleStatus: ContractLifecycleStatus;
  renewalAction: "auto-renew" | "manual-review" | "cancel-window";
  linkedServiceIds: string[];
  totalCommitmentMinor: number;
};

export const SERVICE_RECORDS: ServiceRecord[] = [
  {
    id: "svc-identity-sso",
    vendorId: "vend-okta",
    name: "Identity SSO",
    vendorName: "Okta",
    owner: "IT Operations",
    annualSpendMinor: 1820000,
    renewalDate: "2026-04-20",
    risk: "high",
    replacementStatus: "candidate-review",
    linkedContractIds: ["ctr-sso-main", "ctr-sso-addon"],
    expenseLines: [
      {
        id: "exp-sso-1",
        name: "Workforce IdP",
        amountMinor: 1200000,
        status: "approved"
      },
      {
        id: "exp-sso-2",
        name: "Adaptive MFA",
        amountMinor: 620000,
        status: "committed"
      }
    ]
  },
  {
    id: "svc-cloud-platform",
    vendorId: "vend-aws",
    name: "Cloud Platform",
    vendorName: "AWS",
    owner: "Platform Engineering",
    annualSpendMinor: 5240000,
    renewalDate: "2026-07-15",
    risk: "medium",
    replacementStatus: "not-started",
    linkedContractIds: ["ctr-cloud-ops", "ctr-observability"],
    expenseLines: [
      {
        id: "exp-cloud-1",
        name: "Compute baseline",
        amountMinor: 3420000,
        status: "actual"
      },
      {
        id: "exp-cloud-2",
        name: "Reserved capacity",
        amountMinor: 1820000,
        status: "approved"
      }
    ]
  },
  {
    id: "svc-endpoint-security",
    vendorId: "vend-msft",
    name: "Endpoint Security",
    vendorName: "Microsoft",
    owner: "Security Team",
    annualSpendMinor: 1310000,
    renewalDate: "2026-03-25",
    risk: "high",
    replacementStatus: "candidate-review",
    linkedContractIds: ["ctr-cloud-ops"],
    expenseLines: [
      {
        id: "exp-endpoint-1",
        name: "Defender Plan 2",
        amountMinor: 980000,
        status: "approved"
      },
      {
        id: "exp-endpoint-2",
        name: "Threat analytics add-on",
        amountMinor: 330000,
        status: "planned"
      }
    ]
  }
];

export const CONTRACT_RECORDS: ContractRecord[] = [
  {
    id: "ctr-sso-main",
    vendorId: "vend-okta",
    contractNumber: "CTR-SSO-001",
    providerName: "Okta",
    owner: "IT Operations",
    startDate: "2025-04-21",
    endDate: "2026-04-20",
    renewalDate: "2026-04-20",
    noticeDeadline: "2026-03-20",
    lifecycleStatus: "notice-window",
    renewalAction: "manual-review",
    linkedServiceIds: ["svc-identity-sso"],
    totalCommitmentMinor: 1200000
  },
  {
    id: "ctr-sso-addon",
    vendorId: "vend-okta",
    contractNumber: "CTR-SSO-ADD-02",
    providerName: "Okta",
    owner: "IT Operations",
    startDate: "2025-06-01",
    endDate: "2026-06-01",
    renewalDate: "2026-06-01",
    noticeDeadline: "2026-05-02",
    lifecycleStatus: "renewal-window",
    renewalAction: "manual-review",
    linkedServiceIds: ["svc-identity-sso"],
    totalCommitmentMinor: 620000
  },
  {
    id: "ctr-cloud-ops",
    vendorId: "vend-aws",
    contractNumber: "CTR-CLOUD-OPS-07",
    providerName: "AWS",
    owner: "Platform Engineering",
    startDate: "2025-07-16",
    endDate: "2026-07-15",
    renewalDate: "2026-07-15",
    noticeDeadline: "2026-06-15",
    lifecycleStatus: "active",
    renewalAction: "auto-renew",
    linkedServiceIds: ["svc-cloud-platform", "svc-endpoint-security"],
    totalCommitmentMinor: 4380000
  },
  {
    id: "ctr-observability",
    vendorId: "vend-datadog",
    contractNumber: "CTR-OBS-004",
    providerName: "Datadog",
    owner: "Platform Engineering",
    startDate: "2025-08-01",
    endDate: "2026-08-01",
    renewalDate: "2026-08-01",
    noticeDeadline: "2026-07-02",
    lifecycleStatus: "active",
    renewalAction: "manual-review",
    linkedServiceIds: ["svc-cloud-platform"],
    totalCommitmentMinor: 860000
  }
];

export const SERVICE_BY_ID: Record<string, ServiceRecord> = Object.fromEntries(
  SERVICE_RECORDS.map((service) => [service.id, service])
);

export const CONTRACT_BY_ID: Record<string, ContractRecord> = Object.fromEntries(
  CONTRACT_RECORDS.map((contract) => [contract.id, contract])
);
