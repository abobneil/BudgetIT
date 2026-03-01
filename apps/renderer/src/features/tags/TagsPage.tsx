import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  Text,
  Title3
} from "@fluentui/react-components";

import {
  archiveTag as archiveTagIpc,
  assignTag as assignTagIpc,
  createDimension as createDimensionIpc,
  createTag as createTagIpc,
  isIpcAvailable,
  listDimensions as listDimensionsIpc,
  listExpenses as listExpensesIpc,
  listTags as listTagsIpc,
  mergeTags as mergeTagsIpc,
  type DimensionRecord as IpcDimensionRecord,
  type TagRecord as IpcTagRecord
} from "../../lib/ipcClient";
import { PageHeader } from "../../ui/primitives";
import { useScenarioContext } from "../scenarios/ScenarioContext";
import { TAG_DIMENSIONS } from "./tagging-fixtures";
import {
  assignTag,
  completenessRatio,
  mergeTagInAssignments,
  mergeTagOption,
  retireTagOption,
  type TagAssignments
} from "./tagging-model";
import "./TagsPage.css";

type TaggedEntity = {
  id: string;
  name: string;
  assignments: TagAssignments;
};

const INITIAL_TAGGED_ITEMS: TaggedEntity[] = [
  {
    id: "expense-cloud",
    name: "Cloud Compute",
    assignments: {
      "dim-cost-center": ["tag-engineering"],
      "dim-environment": ["tag-prod"]
    }
  },
  {
    id: "expense-endpoint",
    name: "Endpoint Security",
    assignments: {}
  },
  {
    id: "expense-analytics",
    name: "Analytics Suite",
    assignments: {
      "dim-cost-center": ["tag-finance"],
      "dim-initiative": ["tag-growth"]
    }
  }
];

function toTagId(label: string): string {
  return `tag-${label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function mapIpcDimensions(
  dimensionRows: IpcDimensionRecord[],
  tagRows: IpcTagRecord[]
): typeof TAG_DIMENSIONS {
  return dimensionRows.map((dimension) => ({
    id: dimension.id,
    name: dimension.name,
    mode: dimension.mode,
    required: dimension.required,
    tags: tagRows
      .filter((tag) => tag.dimensionId === dimension.id)
      .map((tag) => ({
        id: tag.id,
        label: tag.name,
        retired: tag.archivedAt !== null
      }))
  }));
}

export function TagsPage() {
  const hasIpc = isIpcAvailable();
  const { selectedScenarioId } = useScenarioContext();
  const [dimensions, setDimensions] = useState(() =>
    structuredClone(TAG_DIMENSIONS)
  );
  const [taggedItems, setTaggedItems] = useState<TaggedEntity[]>(INITIAL_TAGGED_ITEMS);
  const [selectedDimensionId, setSelectedDimensionId] = useState(
    TAG_DIMENSIONS[0]?.id ?? ""
  );
  const [newDimensionName, setNewDimensionName] = useState("");
  const [newDimensionMode, setNewDimensionMode] = useState<"single_select" | "multi_select">(
    "single_select"
  );
  const [newDimensionRequired, setNewDimensionRequired] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [mergeSourceTagId, setMergeSourceTagId] = useState("");
  const [mergeTargetTagId, setMergeTargetTagId] = useState("");
  const [queueSelections, setQueueSelections] = useState<Record<string, string>>({});
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadWorkspaceData = useCallback(async () => {
    if (!hasIpc) {
      return;
    }
    setLoading(true);
    try {
      const [dimensionRows, tagRows, expenseRows] = await Promise.all([
        listDimensionsIpc(),
        listTagsIpc({ entityType: "expense_line" }),
        listExpensesIpc({ scenarioId: selectedScenarioId })
      ]);
      const mappedDimensions = mapIpcDimensions(dimensionRows, tagRows.tags);
      const assignmentsByExpenseId = new Map<string, TagAssignments>();
      for (const assignment of tagRows.assignments) {
        if (assignment.entityType !== "expense_line") {
          continue;
        }
        const existing = assignmentsByExpenseId.get(assignment.entityId) ?? {};
        const forDimension = existing[assignment.dimensionId] ?? [];
        existing[assignment.dimensionId] = forDimension.includes(assignment.tagId)
          ? forDimension
          : [...forDimension, assignment.tagId];
        assignmentsByExpenseId.set(assignment.entityId, existing);
      }
      setDimensions(mappedDimensions);
      setTaggedItems(
        expenseRows.map((expense) => ({
          id: expense.id,
          name: expense.name,
          assignments: assignmentsByExpenseId.get(expense.id) ?? {}
        }))
      );
      if (!mappedDimensions.some((dimension) => dimension.id === selectedDimensionId)) {
        setSelectedDimensionId(mappedDimensions[0]?.id ?? "");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPageMessage(`Failed to load tags workspace: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [hasIpc, selectedDimensionId, selectedScenarioId]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  const selectedDimension =
    dimensions.find((dimension) => dimension.id === selectedDimensionId) ??
    dimensions[0] ??
    null;

  const queueItems = useMemo(() => {
    const requiredDimensions = dimensions.filter((dimension) => dimension.required);
    return taggedItems.flatMap((item) =>
      requiredDimensions
        .filter((dimension) => (item.assignments[dimension.id] ?? []).length === 0)
        .map((dimension) => ({
          itemId: item.id,
          itemName: item.name,
          missingDimensionId: dimension.id
        }))
    );
  }, [dimensions, taggedItems]);

  const completeness = useMemo(
    () => completenessRatio(taggedItems, dimensions),
    [dimensions, taggedItems]
  );

  function handleCreateDimension(): void {
    const trimmed = newDimensionName.trim();
    if (!trimmed) {
      setPageMessage("Dimension name is required.");
      return;
    }

    if (hasIpc) {
      void (async () => {
        try {
          const created = await createDimensionIpc({
            name: trimmed,
            mode: newDimensionMode,
            required: newDimensionRequired
          });
          setNewDimensionName("");
          setNewDimensionRequired(false);
          if (created) {
            setSelectedDimensionId(created.id);
          }
          setPageMessage(`Dimension ${trimmed} created.`);
          await loadWorkspaceData();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setPageMessage(`Failed to create dimension: ${message}`);
        }
      })();
      return;
    }

    const id = `dim-${trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}`;
    setDimensions((current) => [
      ...current,
      {
        id,
        name: trimmed,
        mode: newDimensionMode,
        required: newDimensionRequired,
        tags: []
      }
    ]);
    setSelectedDimensionId(id);
    setNewDimensionName("");
    setNewDimensionRequired(false);
    setPageMessage(`Dimension ${trimmed} created.`);
  }

  function handleCreateTag(): void {
    if (!selectedDimension) {
      return;
    }
    const trimmed = newTagLabel.trim();
    if (!trimmed) {
      setPageMessage("Tag label is required.");
      return;
    }
    const nextTagId = toTagId(trimmed);
    if (selectedDimension.tags.some((tag) => tag.id === nextTagId)) {
      setPageMessage("Tag already exists in this dimension.");
      return;
    }

    if (hasIpc) {
      void (async () => {
        try {
          await createTagIpc({
            dimensionId: selectedDimension.id,
            name: trimmed
          });
          setNewTagLabel("");
          setPageMessage(`Tag ${trimmed} created in ${selectedDimension.name}.`);
          await loadWorkspaceData();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setPageMessage(`Failed to create tag: ${message}`);
        }
      })();
      return;
    }

    setDimensions((current) =>
      current.map((dimension) =>
        dimension.id === selectedDimension.id
          ? {
              ...dimension,
              tags: [...dimension.tags, { id: nextTagId, label: trimmed }]
            }
          : dimension
      )
    );
    setNewTagLabel("");
    setPageMessage(`Tag ${trimmed} created in ${selectedDimension.name}.`);
  }

  function handleRetireTag(tagId: string): void {
    if (!selectedDimension) {
      return;
    }
    if (hasIpc) {
      void (async () => {
        try {
          await archiveTagIpc({ id: tagId, archived: true });
          setPageMessage(`Tag ${tagId} retired.`);
          await loadWorkspaceData();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setPageMessage(`Failed to retire tag: ${message}`);
        }
      })();
      return;
    }
    setDimensions((current) => retireTagOption(current, selectedDimension.id, tagId));
    setPageMessage(`Tag ${tagId} retired.`);
  }

  function handleMergeTags(): void {
    if (!selectedDimension) {
      return;
    }
    if (!mergeSourceTagId || !mergeTargetTagId || mergeSourceTagId === mergeTargetTagId) {
      setPageMessage("Select distinct source and target tags to merge.");
      return;
    }

    if (hasIpc) {
      void (async () => {
        try {
          await mergeTagsIpc({
            dimensionId: selectedDimension.id,
            sourceTagId: mergeSourceTagId,
            targetTagId: mergeTargetTagId
          });
          setPageMessage(`Merged ${mergeSourceTagId} into ${mergeTargetTagId}.`);
          await loadWorkspaceData();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setPageMessage(`Failed to merge tags: ${message}`);
        }
      })();
      return;
    }

    setDimensions((current) =>
      mergeTagOption(current, selectedDimension.id, mergeSourceTagId, mergeTargetTagId)
    );
    setTaggedItems((current) =>
      current.map((item) => ({
        ...item,
        assignments: mergeTagInAssignments(
          item.assignments,
          selectedDimension,
          mergeSourceTagId,
          mergeTargetTagId
        )
      }))
    );
    setPageMessage(`Merged ${mergeSourceTagId} into ${mergeTargetTagId}.`);
  }

  function completeQueueItem(
    itemId: string,
    missingDimensionId: string,
    selectedTagId: string
  ): void {
    const dimension = dimensions.find((entry) => entry.id === missingDimensionId);
    if (!dimension || !selectedTagId) {
      setPageMessage("Select a tag before completing queue item.");
      return;
    }

    if (hasIpc) {
      void (async () => {
        try {
          await assignTagIpc({
            entityType: "expense_line",
            entityId: itemId,
            dimensionId: missingDimensionId,
            tagId: selectedTagId
          });
          setPageMessage(`Completed queue item for ${itemId}.`);
          await loadWorkspaceData();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setPageMessage(`Failed to complete queue item: ${message}`);
        }
      })();
      return;
    }

    setTaggedItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              assignments: assignTag(item.assignments, dimension, selectedTagId)
            }
          : item
      )
    );
    setPageMessage(`Completed queue item for ${itemId}.`);
  }

  return (
    <section className="tags-page">
      <PageHeader
        title="Tags & Dimensions"
        subtitle="Dimension administration, merge/retire operations, and required-tag completeness queue."
        helpTopic="tags-workspace"
      />

      <Card className="tags-summary-card">
        <Text weight="semibold">Tag completeness</Text>
        <Title3 data-testid="tag-completeness">{formatPercent(completeness)}</Title3>
        <Text>{`${queueItems.length} queue item(s) need required tags.`}</Text>
      </Card>

      <Card>
        <Title3>Create Dimension</Title3>
        <div className="tags-detail__merge">
          <div className="tags-detail__field">
            <Text className="tags-detail__label" size={200} weight="medium">
              Dimension name
            </Text>
            <Input
              aria-label="New dimension name"
              value={newDimensionName}
              onChange={(_event, data) => setNewDimensionName(data.value)}
              placeholder="Cost Center"
            />
          </div>
          <div className="tags-detail__field">
            <Text className="tags-detail__label" size={200} weight="medium">
              Mode
            </Text>
            <Select
              aria-label="New dimension mode"
              value={newDimensionMode}
              onChange={(event) =>
                setNewDimensionMode(event.target.value as "single_select" | "multi_select")
              }
            >
              <option value="single_select">single_select</option>
              <option value="multi_select">multi_select</option>
            </Select>
          </div>
          <div className="tags-detail__field">
            <Text className="tags-detail__label" size={200} weight="medium">
              Required
            </Text>
            <Select
              aria-label="New dimension required"
              value={newDimensionRequired ? "yes" : "no"}
              onChange={(event) => setNewDimensionRequired(event.target.value === "yes")}
            >
              <option value="no">no</option>
              <option value="yes">yes</option>
            </Select>
          </div>
          <Button appearance="primary" onClick={handleCreateDimension}>
            Create dimension
          </Button>
        </div>
      </Card>

      {loading ? <Text>Loading tags...</Text> : null}
      {pageMessage ? <Text>{pageMessage}</Text> : null}

      <div className="tags-layout">
        <section className="tags-dimension-list">
          <Title3>Dimensions</Title3>
          <ul className="tags-dimension-list__items">
            {dimensions.map((dimension) => (
              <li key={dimension.id}>
                <Button
                  appearance={selectedDimension?.id === dimension.id ? "primary" : "secondary"}
                  onClick={() => setSelectedDimensionId(dimension.id)}
                >
                  {dimension.name}
                </Button>
                <Badge appearance="filled" color={dimension.required ? "danger" : "brand"}>
                  {dimension.mode === "single_select" ? "Single" : "Multi"}
                </Badge>
              </li>
            ))}
          </ul>
        </section>

        <section className="tags-dimension-detail">
          {selectedDimension ? (
            <Card>
              <Title3>{selectedDimension.name}</Title3>
              <Text>{`Constraint: ${selectedDimension.mode}`}</Text>
              <Text>{`Required: ${selectedDimension.required ? "yes" : "no"}`}</Text>

              <section className="tags-detail__panel">
                <Text weight="semibold">Create tag</Text>
                <div className="tags-detail__create">
                  <div className="tags-detail__field">
                    <Text className="tags-detail__label" size={200} weight="medium">
                      New tag label
                    </Text>
                    <Input
                      aria-label="New tag label"
                      placeholder="Create new tag"
                      value={newTagLabel}
                      onChange={(_event, data) => setNewTagLabel(data.value)}
                    />
                  </div>
                  <Button appearance="primary" onClick={handleCreateTag}>
                    Create tag
                  </Button>
                </div>
              </section>

              <ul className="tags-detail__tag-list">
                {selectedDimension.tags.map((tag) => (
                  <li key={tag.id}>
                    <Badge appearance="tint" color={tag.retired ? "warning" : "brand"}>
                      {tag.label}
                    </Badge>
                    {!tag.retired ? (
                      <Button
                        size="small"
                        appearance="secondary"
                        onClick={() => handleRetireTag(tag.id)}
                      >
                        Retire
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>

              <section className="tags-detail__panel">
                <Text weight="semibold">Merge tags</Text>
                <div className="tags-detail__merge">
                  <div className="tags-detail__field">
                    <Text className="tags-detail__label" size={200} weight="medium">
                      Source tag
                    </Text>
                    <Select
                      aria-label="Merge source tag"
                      value={mergeSourceTagId}
                      onChange={(event) => setMergeSourceTagId(event.target.value)}
                    >
                      <option value="">Select source tag</option>
                      {selectedDimension.tags
                        .filter((tag) => !tag.retired)
                        .map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.label}
                          </option>
                        ))}
                    </Select>
                  </div>
                  <div className="tags-detail__field">
                    <Text className="tags-detail__label" size={200} weight="medium">
                      Target tag
                    </Text>
                    <Select
                      aria-label="Merge target tag"
                      value={mergeTargetTagId}
                      onChange={(event) => setMergeTargetTagId(event.target.value)}
                    >
                      <option value="">Select target tag</option>
                      {selectedDimension.tags
                        .filter((tag) => !tag.retired)
                        .map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.label}
                          </option>
                        ))}
                    </Select>
                  </div>
                  <Button appearance="secondary" onClick={handleMergeTags}>
                    Merge
                  </Button>
                </div>
              </section>
            </Card>
          ) : null}
        </section>
      </div>

      <Card className="tags-queue">
        <Title3>Fix tagging queue</Title3>
        {queueItems.length === 0 ? (
          <Text>All required dimensions are complete.</Text>
        ) : (
          <ul className="tags-queue__items">
            {queueItems.map((entry) => {
              const dimension = dimensions.find((item) => item.id === entry.missingDimensionId);
              const selectionKey = `${entry.itemId}:${entry.missingDimensionId}`;
              return (
                <li key={selectionKey} className="tags-queue__item">
                  <Text>{`${entry.itemName} is missing ${
                    dimension?.name ?? entry.missingDimensionId
                  }`}</Text>
                  <div className="tags-queue__controls">
                    <div className="tags-detail__field">
                      <Text className="tags-detail__label" size={200} weight="medium">
                        Tag assignment
                      </Text>
                      <Select
                        aria-label={`Queue tag ${selectionKey}`}
                        value={queueSelections[selectionKey] ?? ""}
                        onChange={(event) =>
                          setQueueSelections((current) => ({
                            ...current,
                            [selectionKey]: event.target.value
                          }))
                        }
                      >
                        <option value="">Select tag</option>
                        {(dimension?.tags ?? [])
                          .filter((tag) => !tag.retired)
                          .map((tag) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.label}
                            </option>
                          ))}
                      </Select>
                    </div>
                    <Button
                      appearance="primary"
                      onClick={() =>
                        completeQueueItem(
                          entry.itemId,
                          entry.missingDimensionId,
                          queueSelections[selectionKey] ?? ""
                        )
                      }
                    >
                      Complete queue item
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
