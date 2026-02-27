import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  Text,
  Title3
} from "@fluentui/react-components";

import { PageHeader } from "../../ui/primitives";
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

export function TagsPage() {
  const [dimensions, setDimensions] = useState(() =>
    structuredClone(TAG_DIMENSIONS)
  );
  const [taggedItems, setTaggedItems] = useState<TaggedEntity[]>(INITIAL_TAGGED_ITEMS);
  const [selectedDimensionId, setSelectedDimensionId] = useState(
    TAG_DIMENSIONS[0]?.id ?? ""
  );
  const [newTagLabel, setNewTagLabel] = useState("");
  const [mergeSourceTagId, setMergeSourceTagId] = useState("");
  const [mergeTargetTagId, setMergeTargetTagId] = useState("");
  const [queueSelections, setQueueSelections] = useState<Record<string, string>>({});
  const [pageMessage, setPageMessage] = useState<string | null>(null);

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
      />

      <Card className="tags-summary-card">
        <Text weight="semibold">Tag completeness</Text>
        <Title3 data-testid="tag-completeness">{formatPercent(completeness)}</Title3>
        <Text>{`${queueItems.length} queue item(s) need required tags.`}</Text>
      </Card>

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

              <div className="tags-detail__create">
                <Input
                  aria-label="New tag label"
                  placeholder="Create new tag"
                  value={newTagLabel}
                  onChange={(_event, data) => setNewTagLabel(data.value)}
                />
                <Button appearance="primary" onClick={handleCreateTag}>
                  Create tag
                </Button>
              </div>

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

              <div className="tags-detail__merge">
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
                <Button appearance="secondary" onClick={handleMergeTags}>
                  Merge
                </Button>
              </div>
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
                <li key={selectionKey}>
                  <Text>{`${entry.itemName} is missing ${
                    dimension?.name ?? entry.missingDimensionId
                  }`}</Text>
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
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
