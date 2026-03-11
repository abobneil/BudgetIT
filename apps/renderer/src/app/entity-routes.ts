export function buildVendorRoute(vendorId: string): string {
  return `/vendors?vendor=${encodeURIComponent(vendorId)}`;
}

export function buildServiceRoute(serviceId: string): string {
  return `/services?service=${encodeURIComponent(serviceId)}`;
}

export function buildContractRoute(contractId: string): string {
  return `/contracts?contract=${encodeURIComponent(contractId)}`;
}

export function buildExpenseRoute(expenseId: string, scenarioId: string): string {
  const params = new URLSearchParams({
    expense: expenseId,
    scenario: scenarioId
  });
  return `/expenses?${params.toString()}`;
}

export function buildRenewalRoute(contractId: string, serviceId?: string): string {
  const params = new URLSearchParams({
    contract: contractId
  });
  if (serviceId) {
    params.set("service", serviceId);
  }
  return `/renewals?${params.toString()}`;
}

export function buildReplacementRoute(serviceId: string, contractId?: string): string {
  const params = new URLSearchParams({
    service: serviceId
  });
  if (contractId) {
    params.set("contract", contractId);
  }
  return `/replacement?${params.toString()}`;
}
