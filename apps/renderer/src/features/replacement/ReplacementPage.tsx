import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Textarea,
  Title3
} from "@fluentui/react-components";
import { useSearchParams } from "react-router-dom";

import {
  assignCapabilities,
  getReplacementPlan,
  isIpcAvailable,
  listCapabilities,
  listContracts,
  listExpenses,
  listServices,
  listVendors,
  openHelpWindow,
  setReplacementPlanScope,
  setReplacementPlanSelection,
  transitionReplacementPlan,
  upsertCapability,
  upsertReplacementPlan,
  upsertReplacementPlanCandidate,
  type CapabilityRecord,
  type ContractRecord,
  type CoverageItemRecord,
  type ExpenseLineRecord,
  type ReplacementCandidateRecord,
  type ReplacementPlanRecord,
  type ServicePlanAction,
  type ServicePlanDecisionStatus,
  type ServicePlanReasonCode,
  type ServiceRecord,
  type VendorRecord
} from "../../lib/ipcClient";
import { formatCurrencyMinor, parseCurrencyInputToMinor } from "../../lib/currency";
import { EmptyState, InlineError, PageHeader, StatusChip } from "../../ui/primitives";
import { useFeedback } from "../../ui/feedback";
import { toTitleCaseLabel } from "../../ui/text/labelCase";
import { useScenarioContext } from "../scenarios/ScenarioContext";
import "./ReplacementPage.css";

type ReplacementPlanFormState = {
  plannedAction: ServicePlanAction;
  replacementRequired: boolean;
  mustReplaceBy: string;
  reasonCode: ServicePlanReasonCode | "";
  decisionStatus: ServicePlanDecisionStatus;
};

type CandidateFormState = {
  id: string | null;
  candidateServiceId: string;
  candidateName: string;
  annualCost: string;
  currency: string;
  cost: string;
  featureFit: string;
  migrationRisk: string;
  supportQuality: string;
  weightCost: string;
  weightFeatureFit: string;
  weightMigrationRisk: string;
  weightSupportQuality: string;
};

type ScopeDraftState = {
  entityType: CoverageItemRecord["entityType"];
  entityId: string;
};

type CapabilityFormState = {
  name: string;
  category: string;
  description: string;
};

type AssignmentTargetRecord = {
  value: string;
  label: string;
  helper: string;
  capabilityIds: string[];
};

const STATUS_TRANSITIONS: Record<ServicePlanDecisionStatus, ServicePlanDecisionStatus[]> = {
  draft: ["reviewed"],
  reviewed: ["approved", "rejected", "draft"],
  approved: [],
  rejected: ["draft"]
};

const DEFAULT_CANDIDATE_FORM: CandidateFormState = {
  id: null,
  candidateServiceId: "",
  candidateName: "",
  annualCost: "",
  currency: "USD",
  cost: "50",
  featureFit: "50",
  migrationRisk: "50",
  supportQuality: "50",
  weightCost: "0.35",
  weightFeatureFit: "0.30",
  weightMigrationRisk: "0.20",
  weightSupportQuality: "0.15"
};

const DEFAULT_SCOPE_DRAFT: ScopeDraftState = {
  entityType: "service",
  entityId: ""
};

const DEFAULT_CAPABILITY_FORM: CapabilityFormState = {
  name: "",
  category: "",
  description: ""
};

function createPlanFormState(plan: ReplacementPlanRecord | null): ReplacementPlanFormState {
  return {
    plannedAction: plan?.servicePlan.plannedAction ?? "keep",
    replacementRequired: plan?.servicePlan.replacementRequired ?? false,
    mustReplaceBy: plan?.servicePlan.mustReplaceBy ?? "",
    reasonCode: (plan?.servicePlan.reasonCode as ServicePlanReasonCode | null) ?? "",
    decisionStatus: plan?.servicePlan.decisionStatus ?? "draft"
  };
}

function createCandidateFormState(candidate?: ReplacementCandidateRecord): CandidateFormState {
  if (!candidate) {
    return DEFAULT_CANDIDATE_FORM;
  }
  return {
    id: candidate.id,
    candidateServiceId: candidate.candidateServiceId ?? "",
    candidateName: candidate.candidateName ?? "",
    annualCost:
      candidate.annualCostMinor > 0 ? (candidate.annualCostMinor / 100).toFixed(2) : "",
    currency: candidate.currency || "USD",
    cost: String(candidate.scorecard.cost),
    featureFit: String(candidate.scorecard.featureFit),
    migrationRisk: String(candidate.scorecard.migrationRisk),
    supportQuality: String(candidate.scorecard.supportQuality),
    weightCost: String(candidate.scorecard.weights?.cost ?? 0.35),
    weightFeatureFit: String(candidate.scorecard.weights?.featureFit ?? 0.3),
    weightMigrationRisk: String(candidate.scorecard.weights?.migrationRisk ?? 0.2),
    weightSupportQuality: String(candidate.scorecard.weights?.supportQuality ?? 0.15)
  };
}

function resolveStatusTone(status: ServicePlanDecisionStatus): "success" | "warning" | "danger" | "info" {
  if (status === "approved") {
    return "success";
  }
  if (status === "rejected") {
    return "danger";
  }
  if (status === "reviewed") {
    return "info";
  }
  return "warning";
}

function resolvePlanStatusOptions(
  currentStatus: ServicePlanDecisionStatus
): ServicePlanDecisionStatus[] {
  return [currentStatus, ...STATUS_TRANSITIONS[currentStatus]];
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseScoreField(value: string, label: string): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(`${label} must be a number between 0 and 100.`);
  }
  return parsed;
}

function parseWeightField(value: string, label: string): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`${label} must be zero or a positive number.`);
  }
  return parsed;
}

function buildAssignmentTargetValue(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

function formatCapabilityList(capabilities: CapabilityRecord[]): string {
  return capabilities.length > 0
    ? capabilities.map((capability) => capability.name).join(", ")
    : "No capabilities mapped.";
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

export function ReplacementPage() {
  const hasIpc = isIpcAvailable();
  const { selectedScenarioId, selectedScenario } = useScenarioContext();
  const { notify } = useFeedback();
  const [searchParams, setSearchParams] = useSearchParams();
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseLineRecord[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityRecord[]>([]);
  const [planDetail, setPlanDetail] = useState<ReplacementPlanRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingCandidate, setSavingCandidate] = useState(false);
  const [savingScope, setSavingScope] = useState(false);
  const [savingCapabilities, setSavingCapabilities] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    () => searchParams.get("service") ?? ""
  );
  const [selectedContractId, setSelectedContractId] = useState<string | null>(
    () => searchParams.get("contract")
  );
  const [planForm, setPlanForm] = useState<ReplacementPlanFormState>(() =>
    createPlanFormState(null)
  );
  const [candidateForm, setCandidateForm] = useState<CandidateFormState>(
    DEFAULT_CANDIDATE_FORM
  );
  const [scopeDraft, setScopeDraft] = useState<ScopeDraftState>(DEFAULT_SCOPE_DRAFT);
  const [capabilityForm, setCapabilityForm] = useState<CapabilityFormState>(
    DEFAULT_CAPABILITY_FORM
  );
  const [assignmentTarget, setAssignmentTarget] = useState("");
  const [selectedCapabilityIds, setSelectedCapabilityIds] = useState<string[]>([]);

  async function refreshPlanDetail(): Promise<void> {
    if (!hasIpc || !selectedServiceId) {
      setPlanDetail(null);
      return;
    }
    const detail = await getReplacementPlan({
      scenarioId: selectedScenarioId,
      serviceId: selectedServiceId
    });
    setPlanDetail(detail);
    if (detail) {
      setCapabilities(detail.capabilityCatalog);
    }
  }

  useEffect(() => {
    if (!hasIpc) {
      return;
    }
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [nextVendors, nextServices, nextContracts, nextExpenses, nextCapabilities] = await Promise.all([
          listVendors(),
          listServices(),
          listContracts(),
          listExpenses({ scenarioId: selectedScenarioId }),
          listCapabilities()
        ]);
        if (cancelled) {
          return;
        }
        setVendors(nextVendors);
        setServices(nextServices);
        setContracts(nextContracts);
        setExpenses(nextExpenses);
        setCapabilities(nextCapabilities);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        const detail = loadError instanceof Error ? loadError.message : String(loadError);
        setError(`Failed to load replacement workspace: ${detail}`);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasIpc, selectedScenarioId]);

  useEffect(() => {
    if (services.length === 0) {
      return;
    }
    const contractServiceId =
      (selectedContractId
        ? contracts.find((contract) => contract.id === selectedContractId)?.serviceId
        : null) ?? null;
    if (!services.some((service) => service.id === selectedServiceId)) {
      setSelectedServiceId(contractServiceId ?? services[0]?.id ?? "");
    }
  }, [contracts, selectedContractId, selectedServiceId, services]);

  const currentService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) ?? null,
    [selectedServiceId, services]
  );
  const vendorById = useMemo(
    () => Object.fromEntries(vendors.map((vendor) => [vendor.id, vendor])),
    [vendors]
  );
  const serviceContracts = useMemo(
    () => contracts.filter((contract) => contract.serviceId === selectedServiceId),
    [contracts, selectedServiceId]
  );

  useEffect(() => {
    if (services.length === 0) {
      return;
    }
    if (!currentService) {
      if (selectedContractId !== null) {
        setSelectedContractId(null);
      }
      return;
    }
    if (selectedContractId === null) {
      return;
    }
    if (!serviceContracts.some((contract) => contract.id === selectedContractId)) {
      setSelectedContractId(serviceContracts[0]?.id ?? null);
    }
  }, [currentService, selectedContractId, serviceContracts]);

  useEffect(() => {
    if (!hasIpc || !selectedServiceId) {
      setPlanDetail(null);
      return;
    }
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await getReplacementPlan({
          scenarioId: selectedScenarioId,
          serviceId: selectedServiceId
        });
        if (!cancelled) {
          setPlanDetail(detail);
          if (detail) {
            setCapabilities(detail.capabilityCatalog);
          }
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        const detail = loadError instanceof Error ? loadError.message : String(loadError);
        setError(`Failed to load replacement plan: ${detail}`);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasIpc, selectedScenarioId, selectedServiceId]);

  useEffect(() => {
    setPlanForm(createPlanFormState(planDetail));
  }, [planDetail]);

  useEffect(() => {
    const defaultCurrency = planDetail?.coverageSummary.currency ?? "USD";
    setCandidateForm((current) =>
      current.id
        ? current
        : current.currency === defaultCurrency
          ? current
          : {
            ...current,
            currency: current.currency || defaultCurrency
          }
    );
  }, [planDetail?.coverageSummary.currency]);

  useEffect(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (selectedServiceId) {
          next.set("service", selectedServiceId);
        } else {
          next.delete("service");
        }
        if (selectedContractId) {
          next.set("contract", selectedContractId);
        } else {
          next.delete("contract");
        }
        if (planDetail?.servicePlan.id) {
          next.set("plan", planDetail.servicePlan.id);
        } else {
          next.delete("plan");
        }
        return next;
      },
      { replace: true }
    );
  }, [planDetail?.servicePlan.id, selectedContractId, selectedServiceId, setSearchParams]);

  const statusOptions = useMemo(
    () => resolvePlanStatusOptions(planDetail?.servicePlan.decisionStatus ?? "draft"),
    [planDetail?.servicePlan.decisionStatus]
  );
  const candidateChoices = useMemo(
    () =>
      services
        .filter((service) => service.id !== selectedServiceId)
        .map((service) => ({
          id: service.id,
          name: service.name,
          vendorName: vendorById[service.vendorId]?.name ?? service.vendorId
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [selectedServiceId, services, vendorById]
  );
  const currentVendorName =
    (currentService ? vendorById[currentService.vendorId]?.name : null) ??
    currentService?.vendorId ??
    "";
  const selectedContract = selectedContractId
    ? serviceContracts.find((contract) => contract.id === selectedContractId) ?? null
    : null;
  const selectedReplacementCandidate =
    planDetail?.candidates.find(
      (candidate) =>
        candidate.candidateServiceId === planDetail.servicePlan.replacementSelectedServiceId
    ) ?? null;
  const selectedCandidateComparison =
    planDetail?.coverageSummary.candidateComparisons.find(
      (candidate) => candidate.candidateId === selectedReplacementCandidate?.id
    ) ??
    planDetail?.coverageSummary.candidateComparisons[0] ??
    null;
  const assignmentTargets = useMemo<AssignmentTargetRecord[]>(() => {
    const targets: AssignmentTargetRecord[] = [];
    const primaryScopeItem =
      planDetail?.sourceItems.find(
        (item) => item.entityType === "service" && item.entityId === selectedServiceId
      ) ?? null;

    if (primaryScopeItem) {
      targets.push({
        value: buildAssignmentTargetValue("service", primaryScopeItem.entityId),
        label: primaryScopeItem.label,
        helper: "Current service",
        capabilityIds: primaryScopeItem.capabilities.map((capability) => capability.id)
      });
    }

    for (const item of planDetail?.sourceItems ?? []) {
      if (item.entityType === "service" && item.entityId === selectedServiceId) {
        continue;
      }
      targets.push({
        value: buildAssignmentTargetValue(item.entityType, item.entityId),
        label: item.label,
        helper: `Current scope ${toTitleCaseLabel(item.entityType.replace("_", " "))}`,
        capabilityIds: item.capabilities.map((capability) => capability.id)
      });
    }

    for (const candidate of planDetail?.candidates ?? []) {
      targets.push({
        value: buildAssignmentTargetValue("replacement_candidate", candidate.id),
        label: candidate.candidateName ?? "Unnamed candidate",
        helper: "Proposed candidate",
        capabilityIds: candidate.capabilities.map((capability) => capability.id)
      });
    }

    return targets;
  }, [planDetail, selectedServiceId]);
  const selectedScopeKeys = new Set(
    (planDetail?.sourceItems ?? []).map((item) => `${item.entityType}:${item.entityId}`)
  );
  const scopeOptions = useMemo(() => {
    if (scopeDraft.entityType === "service") {
      return services
        .filter((service) => service.id !== selectedServiceId)
        .filter((service) => !selectedScopeKeys.has(`service:${service.id}`))
        .map((service) => ({
          id: service.id,
          label: `${service.name} (${vendorById[service.vendorId]?.name ?? service.vendorId})`
        }));
    }
    if (scopeDraft.entityType === "contract") {
      return contracts
        .filter((contract) => !selectedScopeKeys.has(`contract:${contract.id}`))
        .map((contract) => ({
          id: contract.id,
          label: contract.contractNumber ?? contract.id
        }));
    }
    if (scopeDraft.entityType === "vendor") {
      return vendors
        .filter((vendor) => !selectedScopeKeys.has(`vendor:${vendor.id}`))
        .map((vendor) => ({
          id: vendor.id,
          label: vendor.name
        }));
    }
    return expenses
      .filter((expense) => expense.scenarioId === selectedScenarioId)
      .filter((expense) => !selectedScopeKeys.has(`expense_line:${expense.id}`))
      .map((expense) => ({
        id: expense.id,
        label: `${expense.name} (${formatCurrencyMinor(expense.amountMinor, expense.currency)})`
      }));
  }, [
    contracts,
    expenses,
    scopeDraft.entityType,
    selectedScenarioId,
    selectedScopeKeys,
    selectedServiceId,
    services,
    vendorById,
    vendors
  ]);

  useEffect(() => {
    if (assignmentTargets.length === 0) {
      if (assignmentTarget !== "") {
        setAssignmentTarget("");
      }
      if (selectedCapabilityIds.length > 0) {
        setSelectedCapabilityIds([]);
      }
      return;
    }
    if (!assignmentTargets.some((target) => target.value === assignmentTarget)) {
      setAssignmentTarget(assignmentTargets[0].value);
    }
  }, [assignmentTarget, assignmentTargets, selectedCapabilityIds.length]);

  useEffect(() => {
    const currentTarget = assignmentTargets.find((target) => target.value === assignmentTarget);
    const nextCapabilityIds = currentTarget?.capabilityIds ?? [];
    setSelectedCapabilityIds((current) =>
      arraysEqual(current, nextCapabilityIds) ? current : nextCapabilityIds
    );
  }, [assignmentTarget, assignmentTargets]);

  useEffect(() => {
    if (scopeOptions.length === 0) {
      if (scopeDraft.entityId !== "") {
        setScopeDraft((current) => ({ ...current, entityId: "" }));
      }
      return;
    }
    if (!scopeOptions.some((option) => option.id === scopeDraft.entityId)) {
      setScopeDraft((current) => ({
        ...current,
        entityId: scopeOptions[0].id
      }));
    }
  }, [scopeDraft.entityId, scopeOptions]);

  async function handleSavePlan(): Promise<void> {
    if (!selectedServiceId) {
      setError("Choose a service before saving a replacement plan.");
      return;
    }
    if (planForm.mustReplaceBy && !isIsoDate(planForm.mustReplaceBy)) {
      setError("Must replace by must be YYYY-MM-DD.");
      return;
    }
    if (
      (planForm.decisionStatus === "approved" || planForm.decisionStatus === "rejected") &&
      !planForm.reasonCode
    ) {
      setError("Reason is required when approving or rejecting a plan.");
      return;
    }

    setSavingPlan(true);
    setError(null);
    try {
      let nextPlan = await upsertReplacementPlan({
        scenarioId: selectedScenarioId,
        serviceId: selectedServiceId,
        plannedAction: planForm.plannedAction,
        replacementRequired: planForm.replacementRequired,
        mustReplaceBy: planForm.mustReplaceBy || null,
        reasonCode: planForm.reasonCode || null
      });
      if (planForm.decisionStatus !== nextPlan.servicePlan.decisionStatus) {
        nextPlan = await transitionReplacementPlan({
          servicePlanId: nextPlan.servicePlan.id,
          nextStatus: planForm.decisionStatus,
          ...(planForm.reasonCode ? { reasonCode: planForm.reasonCode } : {})
        });
      }
      setPlanDetail(nextPlan);
      setCapabilities(nextPlan.capabilityCatalog);
      notify({ tone: "success", message: "Replacement plan saved." });
    } catch (saveError) {
      const detail = saveError instanceof Error ? saveError.message : String(saveError);
      setError(`Failed to save replacement plan: ${detail}`);
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleSaveCandidate(): Promise<void> {
    if (!planDetail) {
      setError("Create a replacement plan before adding candidates.");
      return;
    }

    const candidateName =
      candidateForm.candidateName.trim() ||
      candidateChoices.find((choice) => choice.id === candidateForm.candidateServiceId)?.name ||
      "";
    if (!candidateName) {
      setError("Candidate name is required.");
      return;
    }

    try {
      const cost = parseScoreField(candidateForm.cost, "Cost");
      const featureFit = parseScoreField(candidateForm.featureFit, "Feature fit");
      const migrationRisk = parseScoreField(candidateForm.migrationRisk, "Migration risk");
      const supportQuality = parseScoreField(candidateForm.supportQuality, "Support quality");
      const weightCost = parseWeightField(candidateForm.weightCost, "Cost weight");
      const weightFeatureFit = parseWeightField(candidateForm.weightFeatureFit, "Feature fit weight");
      const weightMigrationRisk = parseWeightField(
        candidateForm.weightMigrationRisk,
        "Migration risk weight"
      );
      const weightSupportQuality = parseWeightField(
        candidateForm.weightSupportQuality,
        "Support quality weight"
      );
      const totalWeight =
        weightCost + weightFeatureFit + weightMigrationRisk + weightSupportQuality;
      if (Math.abs(totalWeight - 1) > 0.001) {
        throw new Error("Candidate weights must sum to 1.");
      }

      setSavingCandidate(true);
      setError(null);
      const annualCostMinor =
        candidateForm.annualCost.trim().length > 0
          ? parseCurrencyInputToMinor(candidateForm.annualCost, candidateForm.currency)
          : undefined;
      if (annualCostMinor === null) {
        throw new Error("Proposed annual cost must be a valid currency amount.");
      }
      const nextPlan = await upsertReplacementPlanCandidate({
        ...(candidateForm.id ? { id: candidateForm.id } : {}),
        servicePlanId: planDetail.servicePlan.id,
        ...(candidateForm.candidateServiceId
          ? { candidateServiceId: candidateForm.candidateServiceId }
          : {}),
        candidateName,
        ...(annualCostMinor !== undefined ? { annualCostMinor } : {}),
        currency: candidateForm.currency,
        scorecard: {
          cost,
          featureFit,
          migrationRisk,
          supportQuality,
          weights: {
            cost: weightCost,
            featureFit: weightFeatureFit,
            migrationRisk: weightMigrationRisk,
            supportQuality: weightSupportQuality
          }
        }
      });
      setPlanDetail(nextPlan);
      setCapabilities(nextPlan.capabilityCatalog);
      setCandidateForm({
        ...DEFAULT_CANDIDATE_FORM,
        currency: nextPlan.coverageSummary.currency
      });
      notify({ tone: "success", message: "Replacement candidate saved." });
    } catch (saveError) {
      const detail = saveError instanceof Error ? saveError.message : String(saveError);
      setError(`Failed to save replacement candidate: ${detail}`);
    } finally {
      setSavingCandidate(false);
    }
  }

  async function handleSelectReplacement(candidate: ReplacementCandidateRecord): Promise<void> {
    if (!planDetail || !candidate.candidateServiceId) {
      return;
    }
    setError(null);
    try {
      const nextPlan = await setReplacementPlanSelection({
        servicePlanId: planDetail.servicePlan.id,
        replacementSelectedServiceId: candidate.candidateServiceId
      });
      setPlanDetail(nextPlan);
      setCapabilities(nextPlan.capabilityCatalog);
      notify({ tone: "success", message: "Replacement selection updated." });
    } catch (selectionError) {
      const detail =
        selectionError instanceof Error ? selectionError.message : String(selectionError);
      setError(`Failed to set replacement selection: ${detail}`);
    }
  }

  function handleOpenHelp(): void {
    void openHelpWindow({
      topic: "services-workspace",
      anchor: "detail-tabs",
      q: "replacement plan capability coverage",
      context: "replacement:workspace"
    });
  }

  async function handleSaveScope(): Promise<void> {
    if (!planDetail) {
      setError("Create a replacement plan before editing consolidation scope.");
      return;
    }
    if (!scopeDraft.entityId) {
      setError("Choose an item to add to the consolidation scope.");
      return;
    }

    setSavingScope(true);
    setError(null);
    try {
      const nextPlan = await setReplacementPlanScope({
        servicePlanId: planDetail.servicePlan.id,
        items: [
          ...planDetail.sourceItems
            .filter((item) => !item.implicit)
            .map((item) => ({ entityType: item.entityType, entityId: item.entityId })),
          { entityType: scopeDraft.entityType, entityId: scopeDraft.entityId }
        ]
      });
      setPlanDetail(nextPlan);
      setCapabilities(nextPlan.capabilityCatalog);
      notify({ tone: "success", message: "Consolidation scope updated." });
    } catch (scopeError) {
      const detail = scopeError instanceof Error ? scopeError.message : String(scopeError);
      setError(`Failed to update consolidation scope: ${detail}`);
    } finally {
      setSavingScope(false);
    }
  }

  async function handleRemoveScopeItem(item: CoverageItemRecord): Promise<void> {
    if (!planDetail || item.implicit) {
      return;
    }

    setSavingScope(true);
    setError(null);
    try {
      const nextPlan = await setReplacementPlanScope({
        servicePlanId: planDetail.servicePlan.id,
        items: planDetail.sourceItems
          .filter((entry) => !entry.implicit)
          .filter(
            (entry) =>
              !(entry.entityType === item.entityType && entry.entityId === item.entityId)
          )
          .map((entry) => ({ entityType: entry.entityType, entityId: entry.entityId }))
      });
      setPlanDetail(nextPlan);
      setCapabilities(nextPlan.capabilityCatalog);
      notify({ tone: "success", message: "Scope item removed." });
    } catch (scopeError) {
      const detail = scopeError instanceof Error ? scopeError.message : String(scopeError);
      setError(`Failed to remove scope item: ${detail}`);
    } finally {
      setSavingScope(false);
    }
  }

  async function handleCreateCapability(): Promise<void> {
    if (!capabilityForm.name.trim()) {
      setError("Capability name is required.");
      return;
    }

    setSavingCapabilities(true);
    setError(null);
    try {
      await upsertCapability({
        name: capabilityForm.name.trim(),
        category: capabilityForm.category.trim() || null,
        description: capabilityForm.description.trim() || null
      });
      setCapabilities(await listCapabilities());
      if (planDetail) {
        await refreshPlanDetail();
      }
      setCapabilityForm(DEFAULT_CAPABILITY_FORM);
      notify({ tone: "success", message: "Capability added." });
    } catch (capabilityError) {
      const detail = capabilityError instanceof Error ? capabilityError.message : String(capabilityError);
      setError(`Failed to save capability: ${detail}`);
    } finally {
      setSavingCapabilities(false);
    }
  }

  async function handleSaveAssignments(): Promise<void> {
    if (!assignmentTarget) {
      setError("Choose a capability assignment target.");
      return;
    }
    const [entityType, entityId] = assignmentTarget.split(":");
    if (!entityType || !entityId) {
      setError("Capability assignment target is invalid.");
      return;
    }

    setSavingCapabilities(true);
    setError(null);
    try {
      await assignCapabilities({
        entityType: entityType as
          | "vendor"
          | "service"
          | "contract"
          | "expense_line"
          | "replacement_candidate",
        entityId,
        capabilityIds: selectedCapabilityIds
      });
      await refreshPlanDetail();
      notify({ tone: "success", message: "Capability assignments updated." });
    } catch (assignmentError) {
      const detail = assignmentError instanceof Error ? assignmentError.message : String(assignmentError);
      setError(`Failed to update capability assignments: ${detail}`);
    } finally {
      setSavingCapabilities(false);
    }
  }

  return (
    <section>
      <PageHeader
        title="Replacement Workspace"
        subtitle="Compare capability coverage, define consolidation scope, and move replacement decisions through review for the active scenario."
        actions={
          <Button appearance="secondary" onClick={handleOpenHelp}>
            Replacement Help
          </Button>
        }
      />

      <div className="replacement-toolbar">
        <div className="replacement-toolbar__field">
          <Text size={200} weight="medium">
            Service context
          </Text>
          <Select
            aria-label="Replacement service context"
            value={selectedServiceId}
            onChange={(event) => setSelectedServiceId(event.target.value)}
          >
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="replacement-toolbar__field">
          <Text size={200} weight="medium">
            Contract context
          </Text>
          <Select
            aria-label="Replacement contract context"
            value={selectedContractId ?? ""}
            onChange={(event) =>
              setSelectedContractId(event.target.value.trim() || null)
            }
          >
            <option value="">Service-level plan</option>
            {serviceContracts.map((contract) => (
              <option key={contract.id} value={contract.id}>
                {contract.contractNumber ?? contract.id}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? <Text>Loading replacement workspace...</Text> : null}
      {error ? <InlineError message={error} /> : null}

      {!currentService ? (
        <EmptyState
          title="No service context available"
          description="Choose a service to create or review replacement planning."
        />
      ) : (
        <div className="replacement-layout">
          <section className="replacement-main">
            <Card className="replacement-card">
              <Title3>{currentService.name}</Title3>
              <div className="replacement-summary">
                <div>
                  <Text size={200} weight="medium">
                    Scenario
                  </Text>
                  <Text>{selectedScenario?.name ?? selectedScenarioId}</Text>
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Vendor
                  </Text>
                  <Text>{currentVendorName}</Text>
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Service status
                  </Text>
                  <Text>{toTitleCaseLabel(currentService.status)}</Text>
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Contract focus
                  </Text>
                  <Text>{selectedContract?.contractNumber ?? "Service-level planning"}</Text>
                </div>
              </div>
              <div className="replacement-plan-grid">
                <div>
                  <Text size={200} weight="medium">
                    Planned action
                  </Text>
                  <Select
                    aria-label="Replacement planned action"
                    value={planForm.plannedAction}
                    onChange={(event) =>
                      setPlanForm((current) => ({
                        ...current,
                        plannedAction: event.target.value as ServicePlanAction,
                        replacementRequired: event.target.value === "replace"
                      }))
                    }
                  >
                    <option value="keep">Keep</option>
                    <option value="replace">Replace</option>
                    <option value="retire">Retire</option>
                  </Select>
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Decision status
                  </Text>
                  <Select
                    aria-label="Replacement decision status"
                    value={planForm.decisionStatus}
                    onChange={(event) =>
                      setPlanForm((current) => ({
                        ...current,
                        decisionStatus: event.target.value as ServicePlanDecisionStatus
                      }))
                    }
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {toTitleCaseLabel(status)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Must replace by
                  </Text>
                  <Input
                    aria-label="Replacement deadline"
                    type="date"
                    value={planForm.mustReplaceBy}
                    onChange={(_event, data) =>
                      setPlanForm((current) => ({
                        ...current,
                        mustReplaceBy: data.value
                      }))
                    }
                  />
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Reason
                  </Text>
                  <Select
                    aria-label="Replacement reason"
                    value={planForm.reasonCode}
                    onChange={(event) =>
                      setPlanForm((current) => ({
                        ...current,
                        reasonCode: event.target.value as ServicePlanReasonCode | ""
                      }))
                    }
                  >
                    <option value="">Select reason</option>
                    <option value="cost">Cost</option>
                    <option value="security">Security</option>
                    <option value="eol">EOL</option>
                    <option value="consolidation">Consolidation</option>
                    <option value="performance">Performance</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
                <div className="replacement-plan-grid__full replacement-plan-grid__checkbox">
                  <Checkbox
                    checked={planForm.replacementRequired}
                    label="Replacement selection required before approval"
                    onChange={(_event, data) =>
                      setPlanForm((current) => ({
                        ...current,
                        replacementRequired: Boolean(data.checked)
                      }))
                    }
                  />
                </div>
              </div>
              <Button appearance="primary" disabled={savingPlan} onClick={() => void handleSavePlan()}>
                {savingPlan ? "Saving..." : planDetail ? "Save Replacement Plan" : "Create Replacement Plan"}
              </Button>
            </Card>

            <Card className="replacement-card">
              <div className="replacement-card__header">
                <Title3>Consolidation Scope</Title3>
                <Text>
                  Add the current-state items a bundled replacement would take over, then compare
                  cost and coverage against each candidate.
                </Text>
              </div>
              {!planDetail ? (
                <EmptyState
                  title="Create the plan first"
                  description="Scope management is available after the replacement plan exists."
                />
              ) : (
                <>
                  <div className="replacement-plan-grid replacement-scope-grid">
                    <div>
                      <Text size={200} weight="medium">
                        Scope item type
                      </Text>
                      <Select
                        aria-label="Replacement scope entity type"
                        value={scopeDraft.entityType}
                        onChange={(event) =>
                          setScopeDraft({
                            entityType: event.target.value as ScopeDraftState["entityType"],
                            entityId: ""
                          })
                        }
                      >
                        <option value="service">Service</option>
                        <option value="contract">Contract</option>
                        <option value="expense_line">Expense line</option>
                        <option value="vendor">Vendor</option>
                      </Select>
                    </div>
                    <div>
                      <Text size={200} weight="medium">
                        Scope item
                      </Text>
                      <Select
                        aria-label="Replacement scope entity"
                        value={scopeDraft.entityId}
                        onChange={(event) =>
                          setScopeDraft((current) => ({
                            ...current,
                            entityId: event.target.value
                          }))
                        }
                      >
                        {scopeOptions.length === 0 ? <option value="">No items available</option> : null}
                        {scopeOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div className="replacement-card__actions">
                    <Button appearance="secondary" disabled={savingScope} onClick={() => void handleSaveScope()}>
                      {savingScope ? "Updating..." : "Add To Consolidation Scope"}
                    </Button>
                  </div>
                  <Table aria-label="Replacement scope table">
                    <TableHeader>
                      <TableRow>
                        <TableHeaderCell>Item</TableHeaderCell>
                        <TableHeaderCell>Type</TableHeaderCell>
                        <TableHeaderCell>Annual cost</TableHeaderCell>
                        <TableHeaderCell>Capabilities</TableHeaderCell>
                        <TableHeaderCell>Actions</TableHeaderCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {planDetail.sourceItems.map((item) => (
                        <TableRow key={`${item.entityType}:${item.entityId}`}>
                          <TableCell>{item.label}</TableCell>
                          <TableCell>{toTitleCaseLabel(item.entityType.replace("_", " "))}</TableCell>
                          <TableCell>{formatCurrencyMinor(item.annualCostMinor, item.currency)}</TableCell>
                          <TableCell>{formatCapabilityList(item.capabilities)}</TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              appearance="secondary"
                              disabled={item.implicit || savingScope}
                              onClick={() => void handleRemoveScopeItem(item)}
                            >
                              {item.implicit ? "Primary service" : "Remove"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </Card>

            <Card className="replacement-card">
              <div className="replacement-card__header">
                <Title3>Candidate Comparison</Title3>
                <Text>
                  Compare annual cost, capability coverage, and net delta for each candidate.
                </Text>
              </div>
              {!planDetail ? (
                <EmptyState
                  title="Create the plan first"
                  description="Replacement candidates are stored against an active service plan."
                />
              ) : planDetail.candidates.length === 0 ? (
                <EmptyState
                  title="No candidates yet"
                  description="Add at least one candidate to compare and select a replacement."
                />
              ) : (
                <Table aria-label="Replacement candidates table">
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell>Candidate</TableHeaderCell>
                      <TableHeaderCell>Weighted score</TableHeaderCell>
                      <TableHeaderCell>Annual cost</TableHeaderCell>
                      <TableHeaderCell>Coverage</TableHeaderCell>
                      <TableHeaderCell>Gap count</TableHeaderCell>
                      <TableHeaderCell>Net delta</TableHeaderCell>
                      <TableHeaderCell>Actions</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {planDetail.candidates.map((candidate) => {
                      const isSelected =
                        candidate.candidateServiceId ===
                        planDetail.servicePlan.replacementSelectedServiceId;
                      const comparison =
                        planDetail.coverageSummary.candidateComparisons.find(
                          (entry) => entry.candidateId === candidate.id
                        ) ?? null;
                      return (
                        <TableRow key={candidate.id}>
                          <TableCell>
                            <div className="replacement-candidate__name">
                              <Text>{candidate.candidateName ?? "Unnamed candidate"}</Text>
                              {isSelected ? (
                                <StatusChip label="Selected" tone="success" />
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>{candidate.weightedScore.toFixed(2)}</TableCell>
                          <TableCell>
                            {formatCurrencyMinor(
                              comparison?.proposedAnnualCostMinor ?? candidate.annualCostMinor,
                              comparison?.currency ?? candidate.currency
                            )}
                          </TableCell>
                          <TableCell>{`${comparison?.coveragePct ?? 0}%`}</TableCell>
                          <TableCell>{comparison?.gapCount ?? 0}</TableCell>
                          <TableCell>
                            {formatCurrencyMinor(
                              comparison?.netDeltaMinor ?? 0,
                              comparison?.currency ?? candidate.currency
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="replacement-candidate__actions">
                              <Button
                                size="small"
                                appearance="secondary"
                                onClick={() => setCandidateForm(createCandidateFormState(candidate))}
                              >
                                Edit
                              </Button>
                              <Button
                                size="small"
                                appearance="secondary"
                                disabled={!candidate.candidateServiceId || isSelected}
                                onClick={() => void handleSelectReplacement(candidate)}
                              >
                                {isSelected ? "Selected" : "Select Replacement"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Card>

            <Card className="replacement-card">
              <div className="replacement-card__header">
                <Title3>{candidateForm.id ? "Edit Candidate" : "Add Candidate"}</Title3>
                <Text>Use either a known service or a named market option for comparison.</Text>
              </div>
              <div className="replacement-plan-grid">
                <div>
                  <Text size={200} weight="medium">
                    Candidate service
                  </Text>
                  <Select
                    aria-label="Replacement candidate service"
                    value={candidateForm.candidateServiceId}
                    onChange={(event) => {
                      const nextServiceId = event.target.value;
                      const matched = candidateChoices.find((choice) => choice.id === nextServiceId);
                      setCandidateForm((current) => ({
                        ...current,
                        candidateServiceId: nextServiceId,
                        candidateName:
                          matched && current.candidateName.trim().length === 0
                            ? matched.name
                            : current.candidateName
                      }));
                    }}
                  >
                    <option value="">Custom candidate</option>
                    {candidateChoices.map((choice) => (
                      <option key={choice.id} value={choice.id}>
                        {`${choice.name} (${choice.vendorName})`}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Candidate name
                  </Text>
                  <Input
                    aria-label="Replacement candidate name"
                    value={candidateForm.candidateName}
                    onChange={(_event, data) =>
                      setCandidateForm((current) => ({
                        ...current,
                        candidateName: data.value
                      }))
                    }
                    placeholder="Candidate option"
                  />
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Proposed annual cost
                  </Text>
                  <Input
                    aria-label="Replacement candidate annual cost"
                    inputMode="decimal"
                    value={candidateForm.annualCost}
                    onChange={(_event, data) =>
                      setCandidateForm((current) => ({
                        ...current,
                        annualCost: data.value
                      }))
                    }
                    placeholder="180.00"
                  />
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Currency
                  </Text>
                  <Input
                    aria-label="Replacement candidate currency"
                    value={candidateForm.currency}
                    onChange={(_event, data) =>
                      setCandidateForm((current) => ({
                        ...current,
                        currency: data.value.toUpperCase()
                      }))
                    }
                  />
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Cost score
                  </Text>
                  <Input
                    aria-label="Replacement candidate cost score"
                    inputMode="decimal"
                    value={candidateForm.cost}
                    onChange={(_event, data) =>
                      setCandidateForm((current) => ({ ...current, cost: data.value }))
                    }
                  />
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Feature fit score
                  </Text>
                  <Input
                    aria-label="Replacement candidate feature fit score"
                    inputMode="decimal"
                    value={candidateForm.featureFit}
                    onChange={(_event, data) =>
                      setCandidateForm((current) => ({ ...current, featureFit: data.value }))
                    }
                  />
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Migration risk score
                  </Text>
                  <Input
                    aria-label="Replacement candidate migration risk score"
                    inputMode="decimal"
                    value={candidateForm.migrationRisk}
                    onChange={(_event, data) =>
                      setCandidateForm((current) => ({
                        ...current,
                        migrationRisk: data.value
                      }))
                    }
                  />
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Support quality score
                  </Text>
                  <Input
                    aria-label="Replacement candidate support quality score"
                    inputMode="decimal"
                    value={candidateForm.supportQuality}
                    onChange={(_event, data) =>
                      setCandidateForm((current) => ({
                        ...current,
                        supportQuality: data.value
                      }))
                    }
                  />
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Cost weight
                  </Text>
                  <Input
                    aria-label="Replacement candidate cost weight"
                    inputMode="decimal"
                    value={candidateForm.weightCost}
                    onChange={(_event, data) =>
                      setCandidateForm((current) => ({ ...current, weightCost: data.value }))
                    }
                  />
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Feature fit weight
                  </Text>
                  <Input
                    aria-label="Replacement candidate feature fit weight"
                    inputMode="decimal"
                    value={candidateForm.weightFeatureFit}
                    onChange={(_event, data) =>
                      setCandidateForm((current) => ({
                        ...current,
                        weightFeatureFit: data.value
                      }))
                    }
                  />
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Migration risk weight
                  </Text>
                  <Input
                    aria-label="Replacement candidate migration risk weight"
                    inputMode="decimal"
                    value={candidateForm.weightMigrationRisk}
                    onChange={(_event, data) =>
                      setCandidateForm((current) => ({
                        ...current,
                        weightMigrationRisk: data.value
                      }))
                    }
                  />
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Support quality weight
                  </Text>
                  <Input
                    aria-label="Replacement candidate support quality weight"
                    inputMode="decimal"
                    value={candidateForm.weightSupportQuality}
                    onChange={(_event, data) =>
                      setCandidateForm((current) => ({
                        ...current,
                        weightSupportQuality: data.value
                      }))
                    }
                  />
                </div>
              </div>
              <div className="replacement-candidate-form__actions">
                <Button appearance="primary" disabled={savingCandidate} onClick={() => void handleSaveCandidate()}>
                  {savingCandidate ? "Saving..." : candidateForm.id ? "Save Candidate" : "Add Candidate"}
                </Button>
                <Button
                  appearance="secondary"
                  onClick={() =>
                    setCandidateForm({
                      ...DEFAULT_CANDIDATE_FORM,
                      currency: planDetail?.coverageSummary.currency ?? "USD"
                    })
                  }
                >
                  Reset Candidate Form
                </Button>
              </div>
            </Card>

            <Card className="replacement-card">
              <div className="replacement-card__header">
                <Title3>Capability Coverage</Title3>
                <Text>
                  Maintain a reusable capability catalog and map it to current-scope items or
                  proposed replacement candidates.
                </Text>
              </div>
              <div className="replacement-plan-grid">
                <div>
                  <Text size={200} weight="medium">
                    New capability
                  </Text>
                  <Input
                    aria-label="Replacement capability name"
                    value={capabilityForm.name}
                    onChange={(_event, data) =>
                      setCapabilityForm((current) => ({
                        ...current,
                        name: data.value
                      }))
                    }
                    placeholder="Capability name"
                  />
                </div>
                <div>
                  <Text size={200} weight="medium">
                    Category
                  </Text>
                  <Input
                    aria-label="Replacement capability category"
                    value={capabilityForm.category}
                    onChange={(_event, data) =>
                      setCapabilityForm((current) => ({
                        ...current,
                        category: data.value
                      }))
                    }
                    placeholder="Identity, analytics, endpoint..."
                  />
                </div>
                <div className="replacement-plan-grid__full">
                  <Text size={200} weight="medium">
                    Description
                  </Text>
                  <Textarea
                    aria-label="Replacement capability description"
                    value={capabilityForm.description}
                    onChange={(_event, data) =>
                      setCapabilityForm((current) => ({
                        ...current,
                        description: data.value
                      }))
                    }
                    placeholder="Describe the business outcome this capability supports."
                  />
                </div>
              </div>
              <div className="replacement-card__actions">
                <Button appearance="secondary" disabled={savingCapabilities} onClick={() => void handleCreateCapability()}>
                  {savingCapabilities ? "Saving..." : "Add Capability"}
                </Button>
              </div>

              {!planDetail ? (
                <EmptyState
                  title="Create the plan first"
                  description="Capability assignments are available after the replacement plan exists."
                />
              ) : (
                <>
                  <div className="replacement-plan-grid replacement-capability-grid">
                    <div>
                      <Text size={200} weight="medium">
                        Assignment target
                      </Text>
                      <Select
                        aria-label="Replacement capability assignment target"
                        value={assignmentTarget}
                        onChange={(event) => setAssignmentTarget(event.target.value)}
                      >
                        {assignmentTargets.map((target) => (
                          <option key={target.value} value={target.value}>
                            {`${target.label} (${target.helper})`}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="replacement-plan-grid__full replacement-capability-list">
                      {capabilities.length === 0 ? (
                        <Text>No capabilities yet. Add one above to start mapping coverage.</Text>
                      ) : (
                        capabilities.map((capability) => {
                          const checked = selectedCapabilityIds.includes(capability.id);
                          return (
                            <label key={capability.id} className="replacement-capability-option">
                              <Checkbox
                                checked={checked}
                                onChange={(_event, data) =>
                                  setSelectedCapabilityIds((current) => {
                                    const next = current.filter((id) => id !== capability.id);
                                    return data.checked ? [...next, capability.id] : next;
                                  })
                                }
                              />
                              <span>
                                <strong>{capability.name}</strong>
                                {capability.category ? ` · ${capability.category}` : ""}
                                {capability.description ? ` · ${capability.description}` : ""}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="replacement-card__actions">
                    <Button appearance="primary" disabled={savingCapabilities} onClick={() => void handleSaveAssignments()}>
                      {savingCapabilities ? "Saving..." : "Save Capability Assignments"}
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </section>

          <aside className="replacement-side">
            <Card className="replacement-card">
              <Title3>Plan Snapshot</Title3>
              {planDetail ? (
                <div className="replacement-side__stack">
                  <StatusChip
                    label={toTitleCaseLabel(planDetail.servicePlan.decisionStatus)}
                    tone={resolveStatusTone(planDetail.servicePlan.decisionStatus)}
                  />
                  <Text>{`Plan id: ${planDetail.servicePlan.id}`}</Text>
                  <Text>{`Action: ${toTitleCaseLabel(planDetail.servicePlan.plannedAction)}`}</Text>
                  <Text>{`Reason: ${planDetail.servicePlan.reasonCode ?? "Not set"}`}</Text>
                  <Text>{`Deadline: ${planDetail.servicePlan.mustReplaceBy ?? "Not set"}`}</Text>
                  <Text>
                    {`Selected replacement: ${selectedReplacementCandidate?.candidateName ?? "Not selected"}`}
                  </Text>
                </div>
              ) : (
                <Text>Plan not created yet.</Text>
              )}
            </Card>

            <Card className="replacement-card">
              <Title3>Consolidation Summary</Title3>
              {planDetail ? (
                <div className="replacement-side__stack">
                  <Text>
                    {`Current scope cost: ${formatCurrencyMinor(
                      planDetail.coverageSummary.currentAnnualCostMinor,
                      planDetail.coverageSummary.currency
                    )}`}
                  </Text>
                  <Text>{`Current capability count: ${planDetail.coverageSummary.currentCapabilities.length}`}</Text>
                  <Text>{`Scope items: ${planDetail.coverageSummary.currentItems.length}`}</Text>
                  <Text>
                    {selectedCandidateComparison
                      ? `Selected comparison net delta: ${formatCurrencyMinor(
                          selectedCandidateComparison.netDeltaMinor,
                          selectedCandidateComparison.currency
                        )}`
                      : "Add a candidate to compare scope cost and coverage."}
                  </Text>
                </div>
              ) : (
                <Text>Scope metrics will appear after the plan is created.</Text>
              )}
            </Card>

            <Card className="replacement-card">
              <Title3>Candidate Summary</Title3>
              {selectedCandidateComparison ? (
                <div className="replacement-side__stack">
                  <Text>{`Coverage: ${selectedCandidateComparison.coveragePct}%`}</Text>
                  <Text>{`Overlap: ${selectedCandidateComparison.overlapCount}`}</Text>
                  <Text>{`Gaps: ${selectedCandidateComparison.gapCount}`}</Text>
                  <Text>{`Added capabilities: ${selectedCandidateComparison.addedCount}`}</Text>
                  <Text>
                    {`Proposed cost: ${formatCurrencyMinor(
                      selectedCandidateComparison.proposedAnnualCostMinor,
                      selectedCandidateComparison.currency
                    )}`}
                  </Text>
                </div>
              ) : (
                <Text>Candidate metrics will appear after the plan is created.</Text>
              )}
            </Card>

            <Card className="replacement-card">
              <Title3>Working Notes</Title3>
              <Textarea
                aria-label="Replacement working notes"
                readOnly
                value={
                  selectedCandidateComparison
                    ? `Overlap: ${formatCapabilityList(selectedCandidateComparison.overlapCapabilities)}\nGaps: ${formatCapabilityList(selectedCandidateComparison.gapCapabilities)}\nAdded: ${formatCapabilityList(selectedCandidateComparison.addedCapabilities)}`
                    : "Select a candidate to review capability overlap, gaps, and added coverage."
                }
              />
            </Card>
          </aside>
        </div>
      )}
    </section>
  );
}
