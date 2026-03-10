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
  ownerId: string;
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
  ownerId: string;
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

export const SERVICE_RECORDS: ServiceRecord[] = [];

export const CONTRACT_RECORDS: ContractRecord[] = [];

export const SERVICE_BY_ID: Record<string, ServiceRecord> = Object.fromEntries(
  SERVICE_RECORDS.map((service) => [service.id, service])
);

export const CONTRACT_BY_ID: Record<string, ContractRecord> = Object.fromEntries(
  CONTRACT_RECORDS.map((contract) => [contract.id, contract])
);
