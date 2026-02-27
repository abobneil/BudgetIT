export type DimensionMode = "single_select" | "multi_select";

export type TagOption = {
  id: string;
  label: string;
  retired?: boolean;
};

export type DimensionDefinition = {
  id: string;
  name: string;
  mode: DimensionMode;
  required: boolean;
  tags: TagOption[];
};

export type TagAssignments = Record<string, string[]>;

export function assignTag(
  assignments: TagAssignments,
  dimension: DimensionDefinition,
  tagId: string
): TagAssignments {
  const current = assignments[dimension.id] ?? [];
  if (dimension.mode === "single_select") {
    return {
      ...assignments,
      [dimension.id]: [tagId]
    };
  }

  if (current.includes(tagId)) {
    return {
      ...assignments,
      [dimension.id]: current.filter((value) => value !== tagId)
    };
  }

  return {
    ...assignments,
    [dimension.id]: [...current, tagId]
  };
}

export function removeTag(
  assignments: TagAssignments,
  dimensionId: string,
  tagId: string
): TagAssignments {
  const current = assignments[dimensionId] ?? [];
  return {
    ...assignments,
    [dimensionId]: current.filter((value) => value !== tagId)
  };
}

export function retireTagOption(
  dimensions: DimensionDefinition[],
  dimensionId: string,
  tagId: string
): DimensionDefinition[] {
  return dimensions.map((dimension) => {
    if (dimension.id !== dimensionId) {
      return dimension;
    }
    return {
      ...dimension,
      tags: dimension.tags.map((tag) =>
        tag.id === tagId ? { ...tag, retired: true } : tag
      )
    };
  });
}

export function mergeTagOption(
  dimensions: DimensionDefinition[],
  dimensionId: string,
  sourceTagId: string,
  targetTagId: string
): DimensionDefinition[] {
  if (sourceTagId === targetTagId) {
    return dimensions;
  }

  return dimensions.map((dimension) => {
    if (dimension.id !== dimensionId) {
      return dimension;
    }
    const hasTarget = dimension.tags.some((tag) => tag.id === targetTagId);
    if (!hasTarget) {
      return dimension;
    }
    return {
      ...dimension,
      tags: dimension.tags.map((tag) =>
        tag.id === sourceTagId ? { ...tag, retired: true } : tag
      )
    };
  });
}

export function mergeTagInAssignments(
  assignments: TagAssignments,
  dimension: DimensionDefinition,
  sourceTagId: string,
  targetTagId: string
): TagAssignments {
  const current = assignments[dimension.id] ?? [];
  const mapped = current.map((tagId) => (tagId === sourceTagId ? targetTagId : tagId));
  const deduped = Array.from(new Set(mapped));
  if (dimension.mode === "single_select") {
    return {
      ...assignments,
      [dimension.id]: deduped.slice(0, 1)
    };
  }
  return {
    ...assignments,
    [dimension.id]: deduped
  };
}

export function completenessRatio(
  items: Array<{ assignments: TagAssignments }>,
  dimensions: DimensionDefinition[]
): number {
  const requiredDimensions = dimensions.filter((dimension) => dimension.required);
  if (requiredDimensions.length === 0 || items.length === 0) {
    return 1;
  }

  const completeCount = items.filter((item) =>
    requiredDimensions.every((dimension) => {
      const values = item.assignments[dimension.id] ?? [];
      return values.length > 0;
    })
  ).length;

  return completeCount / items.length;
}
