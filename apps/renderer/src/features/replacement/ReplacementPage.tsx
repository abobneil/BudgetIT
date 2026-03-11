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
  getReplacementPlan,
  isIpcAvailable,
  listContracts,
  listServices,
  listVendors,
  openHelpWindow,
  setReplacementPlanSelection,
  transitionReplacementPlan,
  upsertReplacementPlan,
  upsertReplacementPlanCandidate,
  type ContractRecord,
  type ReplacementCandidateRecord,
  type ReplacementPlanRecord,
  type ServicePlanAction,
  type ServicePlanDecisionStatus,
  type ServicePlanReasonCode,
  type ServiceRecord,
  type VendorRecord
} from "../../lib/ipcClient";
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
  cost: string;
  featureFit: string;
  migrationRisk: string;
  supportQuality: string;
  weightCost: string;
  weightFeatureFit: string;
  weightMigrationRisk: string;
  weightSupportQuality: string;
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
  cost: "50",
  featureFit: "50",
  migrationRisk: "50",
  supportQuality: "50",
  weightCost: "0.35",
  weightFeatureFit: "0.30",
  weightMigrationRisk: "0.20",
  weightSupportQuality: "0.15"
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

export function ReplacementPage() {
  const hasIpc = isIpcAvailable();
  const { selectedScenarioId, selectedScenario } = useScenarioContext();
  const { notify } = useFeedback();
  const [searchParams, setSearchParams] = useSearchParams();
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [planDetail, setPlanDetail] = useState<ReplacementPlanRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingCandidate, setSavingCandidate] = useState(false);
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

  useEffect(() => {
    if (!hasIpc) {
      return;
    }
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [nextVendors, nextServices, nextContracts] = await Promise.all([
          listVendors(),
          listServices(),
          listContracts()
        ]);
        if (cancelled) {
          return;
        }
        setVendors(nextVendors);
        setServices(nextServices);
        setContracts(nextContracts);
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
  }, [hasIpc]);

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
      const nextPlan = await upsertReplacementPlanCandidate({
        ...(candidateForm.id ? { id: candidateForm.id } : {}),
        servicePlanId: planDetail.servicePlan.id,
        ...(candidateForm.candidateServiceId
          ? { candidateServiceId: candidateForm.candidateServiceId }
          : {}),
        candidateName,
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
      setCandidateForm(DEFAULT_CANDIDATE_FORM);
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
      q: "replacement plan",
      context: "replacement:workspace"
    });
  }

  return (
    <section>
      <PageHeader
        title="Replacement Workspace"
        subtitle="Compare options, document plan intent, and move replacement decisions through review for the active scenario."
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
                <Title3>Candidate Comparison</Title3>
                <Text>
                  Weighted scorecards support cost, feature fit, migration risk, and support quality.
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
                      <TableHeaderCell>Cost</TableHeaderCell>
                      <TableHeaderCell>Feature fit</TableHeaderCell>
                      <TableHeaderCell>Migration risk</TableHeaderCell>
                      <TableHeaderCell>Support quality</TableHeaderCell>
                      <TableHeaderCell>Actions</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {planDetail.candidates.map((candidate) => {
                      const isSelected =
                        candidate.candidateServiceId ===
                        planDetail.servicePlan.replacementSelectedServiceId;
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
                          <TableCell>{candidate.scorecard.cost}</TableCell>
                          <TableCell>{candidate.scorecard.featureFit}</TableCell>
                          <TableCell>{candidate.scorecard.migrationRisk}</TableCell>
                          <TableCell>{candidate.scorecard.supportQuality}</TableCell>
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
                  onClick={() => setCandidateForm(DEFAULT_CANDIDATE_FORM)}
                >
                  Reset Candidate Form
                </Button>
              </div>
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
              <Title3>Candidate Summary</Title3>
              {planDetail ? (
                <div className="replacement-side__stack">
                  <Text>{`Candidates: ${planDetail.aggregation.candidateCount}`}</Text>
                  <Text>
                    {`Average weighted score: ${planDetail.aggregation.averageWeightedScore.toFixed(2)}`}
                  </Text>
                  <Text>
                    {`Best weighted score: ${planDetail.aggregation.bestWeightedScore?.toFixed(2) ?? "N/A"}`}
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
                  selectedReplacementCandidate
                    ? `${selectedReplacementCandidate.candidateName ?? "Selected candidate"} is currently selected for this plan.`
                    : "Select a candidate to capture the current preferred replacement."
                }
              />
            </Card>
          </aside>
        </div>
      )}
    </section>
  );
}
