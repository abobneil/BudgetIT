/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { FluentProvider } from "@fluentui/react-components";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assignCapabilities,
  getReplacementPlan,
  isIpcAvailable,
  listCapabilities,
  listContracts,
  listExpenses,
  listServices,
  listVendors,
  setReplacementPlanScope,
  upsertCapability,
  type CapabilityRecord,
  type ReplacementPlanRecord
} from "../../lib/ipcClient";
import { budgetItLightTheme } from "../../ui/theme";
import { ReplacementPage } from "./ReplacementPage";

vi.mock("../../lib/ipcClient", () => ({
  assignCapabilities: vi.fn(),
  getReplacementPlan: vi.fn(),
  isIpcAvailable: vi.fn(),
  listCapabilities: vi.fn(),
  listContracts: vi.fn(),
  listExpenses: vi.fn(),
  listServices: vi.fn(),
  listVendors: vi.fn(),
  openHelpWindow: vi.fn(),
  setReplacementPlanScope: vi.fn(),
  setReplacementPlanSelection: vi.fn(),
  transitionReplacementPlan: vi.fn(),
  upsertCapability: vi.fn(),
  upsertReplacementPlan: vi.fn(),
  upsertReplacementPlanCandidate: vi.fn()
}));

vi.mock("../scenarios/ScenarioContext", () => ({
  useScenarioContext: () => ({
    selectedScenarioId: "baseline",
    selectedScenario: { id: "baseline", name: "Baseline" }
  })
}));

vi.mock("../../ui/feedback", () => ({
  useFeedback: () => ({
    notify: vi.fn()
  })
}));

const isIpcAvailableMock = vi.mocked(isIpcAvailable);
const listVendorsMock = vi.mocked(listVendors);
const listServicesMock = vi.mocked(listServices);
const listContractsMock = vi.mocked(listContracts);
const listExpensesMock = vi.mocked(listExpenses);
const listCapabilitiesMock = vi.mocked(listCapabilities);
const getReplacementPlanMock = vi.mocked(getReplacementPlan);
const upsertCapabilityMock = vi.mocked(upsertCapability);
const assignCapabilitiesMock = vi.mocked(assignCapabilities);
const setReplacementPlanScopeMock = vi.mocked(setReplacementPlanScope);

function createPlan(): ReplacementPlanRecord {
  return {
    servicePlan: {
      id: "plan-1",
      scenarioId: "baseline",
      serviceId: "svc-1",
      plannedAction: "replace",
      decisionStatus: "reviewed",
      reasonCode: "consolidation",
      mustReplaceBy: "2026-12-31",
      replacementRequired: true,
      replacementSelectedServiceId: "svc-2"
    },
    candidates: [
      {
        id: "candidate-1",
        servicePlanId: "plan-1",
        candidateServiceId: "svc-2",
        candidateName: "Unified Platform",
        annualCostMinor: 18000,
        currency: "USD",
        capabilities: [],
        weightedScore: 88,
        scorecard: {
          cost: 80,
          featureFit: 92,
          migrationRisk: 74,
          supportQuality: 88
        }
      }
    ],
    sourceItems: [
      {
        entityType: "service",
        entityId: "svc-1",
        label: "Current Suite",
        annualCostMinor: 26000,
        currency: "USD",
        capabilities: [
          { id: "cap-1", name: "Identity", category: "Access", description: null }
        ],
        implicit: true
      }
    ],
    capabilityCatalog: [
      { id: "cap-1", name: "Identity", category: "Access", description: null }
    ],
    coverageSummary: {
      currency: "USD",
      currentAnnualCostMinor: 26000,
      currentCapabilities: [
        { id: "cap-1", name: "Identity", category: "Access", description: null }
      ],
      currentItems: [
        {
          entityType: "service",
          entityId: "svc-1",
          label: "Current Suite",
          annualCostMinor: 26000,
          currency: "USD",
          capabilities: [
            { id: "cap-1", name: "Identity", category: "Access", description: null }
          ],
          implicit: true
        }
      ],
      candidateComparisons: [
        {
          candidateId: "candidate-1",
          candidateName: "Unified Platform",
          currency: "USD",
          currentAnnualCostMinor: 26000,
          proposedAnnualCostMinor: 18000,
          netDeltaMinor: -8000,
          coveragePct: 100,
          overlapCount: 1,
          gapCount: 0,
          addedCount: 0,
          overlapCapabilities: [
            { id: "cap-1", name: "Identity", category: "Access", description: null }
          ],
          gapCapabilities: [],
          addedCapabilities: []
        }
      ]
    },
    aggregation: {
      candidateCount: 1,
      averageWeightedScore: 88,
      bestCandidateId: "candidate-1",
      bestWeightedScore: 88
    }
  };
}

function renderPage() {
  return render(
    <FluentProvider theme={budgetItLightTheme}>
      <MemoryRouter>
        <ReplacementPage />
      </MemoryRouter>
    </FluentProvider>
  );
}

describe("ReplacementPage", () => {
  let plan: ReplacementPlanRecord;
  let capabilities: CapabilityRecord[];

  beforeEach(() => {
    plan = createPlan();
    capabilities = [...plan.capabilityCatalog];

    isIpcAvailableMock.mockReturnValue(true);
    listVendorsMock.mockResolvedValue([
      {
        id: "vendor-1",
        name: "Vendor One",
        website: null,
        notes: null,
        ownerId: null,
        owner: null,
        annualSpendMinor: 26000,
        status: "active",
        risk: "low",
        createdAt: "",
        updatedAt: "",
        deletedAt: null
      }
    ]);
    listServicesMock.mockResolvedValue([
      {
        id: "svc-1",
        vendorId: "vendor-1",
        name: "Current Suite",
        status: "active",
        ownerId: null,
        ownerTeam: null,
        annualSpendMinor: 26000,
        risk: "low",
        replacementStatus: "candidate-review",
        createdAt: "",
        updatedAt: "",
        deletedAt: null
      },
      {
        id: "svc-2",
        vendorId: "vendor-1",
        name: "Unified Platform",
        status: "active",
        ownerId: null,
        ownerTeam: null,
        annualSpendMinor: 18000,
        risk: "low",
        replacementStatus: "approved",
        createdAt: "",
        updatedAt: "",
        deletedAt: null
      }
    ]);
    listContractsMock.mockResolvedValue([]);
    listExpensesMock.mockResolvedValue([]);
    listCapabilitiesMock.mockImplementation(async () => capabilities);
    getReplacementPlanMock.mockImplementation(async () => plan);
    upsertCapabilityMock.mockImplementation(async ({ name, category, description }) => {
      const next = {
        id: `cap-${capabilities.length + 1}`,
        name,
        category: category ?? null,
        description: description ?? null
      };
      capabilities = [...capabilities, next];
      plan = {
        ...plan,
        capabilityCatalog: capabilities
      };
      return next;
    });
    assignCapabilitiesMock.mockResolvedValue(capabilities);
    setReplacementPlanScopeMock.mockImplementation(async () => plan);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders consolidation and capability coverage details and supports capability creation", async () => {
    renderPage();

    await screen.findByText("Consolidation Scope");
    expect(screen.getByText("Capability Coverage")).toBeInTheDocument();
    expect(screen.getByText("Consolidation Summary")).toBeInTheDocument();
    expect(screen.getByText("Candidate Summary")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Replacement capability name"), {
      target: { value: "Endpoint" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Capability" }));

    await waitFor(() => {
      expect(upsertCapabilityMock).toHaveBeenCalledWith({
        name: "Endpoint",
        category: null,
        description: null
      });
    });
  });
});
