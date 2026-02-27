import type { DimensionDefinition } from "./tagging-model";

export const TAG_DIMENSIONS: DimensionDefinition[] = [
  {
    id: "dim-cost-center",
    name: "Cost Center",
    mode: "single_select",
    required: true,
    tags: [
      { id: "tag-engineering", label: "Engineering" },
      { id: "tag-security", label: "Security" },
      { id: "tag-finance", label: "Finance" }
    ]
  },
  {
    id: "dim-environment",
    name: "Environment",
    mode: "multi_select",
    required: false,
    tags: [
      { id: "tag-prod", label: "Production" },
      { id: "tag-stage", label: "Staging" },
      { id: "tag-dev", label: "Development" }
    ]
  },
  {
    id: "dim-initiative",
    name: "Initiative",
    mode: "single_select",
    required: false,
    tags: [
      { id: "tag-growth", label: "Growth" },
      { id: "tag-stability", label: "Stability" }
    ]
  }
];
