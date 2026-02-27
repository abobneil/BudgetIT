import { describe, expect, it } from "vitest";

import { TAG_DIMENSIONS } from "./tagging-fixtures";
import {
  assignTag,
  completenessRatio,
  mergeTagInAssignments,
  mergeTagOption,
  retireTagOption,
  type TagAssignments
} from "./tagging-model";

describe("tagging model", () => {
  it("enforces single-select and multi-select assignment constraints", () => {
    const costCenter = TAG_DIMENSIONS[0];
    const environment = TAG_DIMENSIONS[1];

    let assignments: TagAssignments = {};
    assignments = assignTag(assignments, costCenter, "tag-engineering");
    assignments = assignTag(assignments, costCenter, "tag-finance");
    expect(assignments[costCenter.id]).toEqual(["tag-finance"]);

    assignments = assignTag(assignments, environment, "tag-prod");
    assignments = assignTag(assignments, environment, "tag-stage");
    expect(assignments[environment.id]).toEqual(["tag-prod", "tag-stage"]);
    assignments = assignTag(assignments, environment, "tag-prod");
    expect(assignments[environment.id]).toEqual(["tag-stage"]);
  });

  it("applies merge/retire behavior and updates completeness ratio", () => {
    const costCenter = TAG_DIMENSIONS[0];
    const initialItems = [
      { assignments: { [costCenter.id]: ["tag-engineering"] } },
      { assignments: {} },
      { assignments: { [costCenter.id]: ["tag-finance"] } }
    ];
    expect(completenessRatio(initialItems, TAG_DIMENSIONS)).toBeCloseTo(2 / 3, 5);

    const mergedDimensions = mergeTagOption(
      TAG_DIMENSIONS,
      costCenter.id,
      "tag-engineering",
      "tag-finance"
    );
    const retiredDimensions = retireTagOption(
      mergedDimensions,
      costCenter.id,
      "tag-security"
    );
    const mergedTag = retiredDimensions
      .find((dimension) => dimension.id === costCenter.id)
      ?.tags.find((tag) => tag.id === "tag-engineering");
    expect(mergedTag?.retired).toBe(true);

    const reassigned = mergeTagInAssignments(
      { [costCenter.id]: ["tag-engineering"] },
      costCenter,
      "tag-engineering",
      "tag-finance"
    );
    expect(reassigned[costCenter.id]).toEqual(["tag-finance"]);
  });
});
