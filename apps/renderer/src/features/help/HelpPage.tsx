import {
  createElement,
  isValidElement,
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode
} from "react";
import {
  Button,
  Checkbox,
  Input,
  Select,
  Text,
  Title2
} from "@fluentui/react-components";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSearchParams } from "react-router-dom";

import {
  getWindowLocalStorage,
  readStoredJson,
  writeStoredJson
} from "../../lib/browserStorage";
import { getHelpDocument } from "../../lib/ipcClient";
import { QUICK_START_CHECKLIST_STORAGE_KEY } from "../../lib/machineLocalState";
import { InlineError, LoadingState } from "../../ui/primitives";
import {
  buildHelpHashPath,
  HELP_TOPICS,
  resolveHelpTopic,
  type HelpJourneyStep
} from "./help-topics";
import "./HelpPage.css";

type SectionExtraction = {
  markdown: string;
  found: boolean;
};

type QuickStartChecklistState = Record<string, boolean>;

type QuickStartChecklistItem = {
  id: string;
  label: string;
};

type QuickStartJourneyLink = {
  topic: string;
  label: string;
  anchor?: string;
};

type TopicGroup = {
  id: HelpJourneyStep;
  label: string;
  topics: (typeof HELP_TOPICS)[number][];
};

const JOURNEY_STEP_ORDER: HelpJourneyStep[] = [
  "orientation",
  "setup",
  "import",
  "analysis",
  "reporting",
  "operations"
];

const JOURNEY_STEP_LABELS: Record<HelpJourneyStep, string> = {
  orientation: "Orientation",
  setup: "Setup",
  import: "Import & Reconciliation",
  analysis: "Analysis",
  reporting: "Reporting",
  operations: "Operations"
};

const QUICK_START_CHECKLIST_ITEMS: QuickStartChecklistItem[] = [
  {
    id: "configure-settings",
    label: "Configure startup/tray/runtime settings in Settings."
  },
  {
    id: "create-backup",
    label: "Create and verify the first backup."
  },
  {
    id: "confirm-scenario",
    label: "Confirm Scenario is set to Baseline before data setup."
  },
  {
    id: "add-core-records",
    label: "Add Vendors, Services, Contracts, and Expenses."
  },
  {
    id: "configure-dimensions",
    label: "Set required dimensions in Tags & Dimensions."
  },
  {
    id: "validate-dashboard",
    label: "Validate Dashboard KPIs/variance cards after setup."
  }
];

const QUICK_START_JOURNEY_LINKS: QuickStartJourneyLink[] = [
  { topic: "vendors-workspace", label: "Step 1: Vendors setup", anchor: "overview" },
  { topic: "services-workspace", label: "Step 2: Services setup", anchor: "overview" },
  { topic: "contracts-workspace", label: "Step 3: Contracts setup", anchor: "overview" },
  { topic: "expenses-workspace", label: "Step 4: Expenses setup", anchor: "overview" },
  { topic: "tags-workspace", label: "Step 5: Tags & dimensions", anchor: "overview" },
  { topic: "dashboard-overview", label: "Step 6: Validate in Dashboard", anchor: "kpi-cards" }
];

function loadQuickStartChecklistState(): QuickStartChecklistState {
  const storage = getWindowLocalStorage();
  const parsed = readStoredJson<Record<string, unknown>>(
    storage,
    QUICK_START_CHECKLIST_STORAGE_KEY
  );
  if (!parsed || typeof parsed !== "object") {
    return {};
  }

  const next: QuickStartChecklistState = {};
  for (const item of QUICK_START_CHECKLIST_ITEMS) {
    next[item.id] = parsed[item.id] === true;
  }
  return next;
}

function persistQuickStartChecklistState(state: QuickStartChecklistState): void {
  writeStoredJson(getWindowLocalStorage(), QUICK_START_CHECKLIST_STORAGE_KEY, state);
}

function decodeAnchorValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toHeadingId(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function flattenNodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map((entry) => flattenNodeText(entry)).join(" ");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return flattenNodeText(node.props.children);
  }
  return "";
}

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
type HeadingProps = ComponentPropsWithoutRef<"h1">;

function createHeadingRenderer(tag: HeadingTag) {
  return function MarkdownHeading({
    children,
    node,
    ...props
  }: HeadingProps & { node?: unknown }) {
    void node;
    const derivedId = toHeadingId(flattenNodeText(children));
    return createElement(tag, { ...props, id: derivedId }, children);
  };
}

const MARKDOWN_COMPONENTS = {
  h1: createHeadingRenderer("h1"),
  h2: createHeadingRenderer("h2"),
  h3: createHeadingRenderer("h3"),
  h4: createHeadingRenderer("h4"),
  h5: createHeadingRenderer("h5"),
  h6: createHeadingRenderer("h6")
};

function getHelpTopicSearchScore(topic: (typeof HELP_TOPICS)[number], query: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return 0;
  }

  const title = topic.title.toLowerCase();
  const id = topic.id.toLowerCase();
  const snippet = topic.inAppSnippet.toLowerCase();
  const section = topic.docSection.toLowerCase();
  const keywords = topic.keywords.map((keyword) => keyword.toLowerCase());

  if (title === normalizedQuery || id === normalizedQuery) {
    return 120;
  }
  if (title.startsWith(normalizedQuery) || id.startsWith(normalizedQuery)) {
    return 100;
  }
  if (title.includes(normalizedQuery) || id.includes(normalizedQuery)) {
    return 80;
  }
  if (section.includes(normalizedQuery)) {
    return 70;
  }
  if (keywords.some((keyword) => keyword.includes(normalizedQuery))) {
    return 60;
  }
  if (snippet.includes(normalizedQuery)) {
    return 40;
  }
  return 0;
}

function extractSection(markdown: string, sectionHeading: string): SectionExtraction {
  const lines = markdown.split(/\r?\n/);
  const headingLine = `## ${sectionHeading}`;
  const sectionStart = lines.findIndex(
    (line) => line.trim() === headingLine
  );
  if (sectionStart < 0) {
    return {
      markdown: markdown.trim(),
      found: false
    };
  }

  let sectionEnd = lines.length;
  for (let index = sectionStart + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      sectionEnd = index;
      break;
    }
  }
  return {
    markdown: lines.slice(sectionStart, sectionEnd).join("\n").trim(),
    found: true
  };
}

export function HelpPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentMarkdown, setDocumentMarkdown] = useState("");
  const [quickStartChecklistState, setQuickStartChecklistState] =
    useState<QuickStartChecklistState>(() => loadQuickStartChecklistState());
  const topicQuerySeed = searchParams.get("q")?.trim() ?? "";
  const helpContext = searchParams.get("context")?.trim() ?? "";
  const [topicSearchQuery, setTopicSearchQuery] = useState(topicQuerySeed);
  const selectedAnchor = searchParams.get("anchor")?.trim() ?? "";

  const selectedTopic = resolveHelpTopic(searchParams.get("topic"));
  const normalizedTopicSearchQuery = topicSearchQuery.trim().toLowerCase();

  const indexedTopics = useMemo(
    () =>
      HELP_TOPICS.map((topic) => ({
        topic,
        score: getHelpTopicSearchScore(topic, normalizedTopicSearchQuery)
      }))
        .filter((entry) => normalizedTopicSearchQuery.length === 0 || entry.score > 0)
        .sort((left, right) => right.score - left.score)
        .map((entry) => entry.topic),
    [normalizedTopicSearchQuery]
  );

  const selectableTopics = useMemo(() => {
    if (normalizedTopicSearchQuery.length === 0) {
      return HELP_TOPICS;
    }
    if (indexedTopics.some((topic) => topic.id === selectedTopic.id)) {
      return indexedTopics;
    }
    return [selectedTopic, ...indexedTopics];
  }, [indexedTopics, normalizedTopicSearchQuery, selectedTopic]);

  const selectableTopicGroups = useMemo<TopicGroup[]>(() => {
    const groups = new Map<HelpJourneyStep, (typeof HELP_TOPICS)[number][]>();
    for (const topic of selectableTopics) {
      const existing = groups.get(topic.journeyStep);
      if (existing) {
        existing.push(topic);
      } else {
        groups.set(topic.journeyStep, [topic]);
      }
    }

    return Array.from(groups.entries())
      .sort((left, right) => {
        const leftIndex = JOURNEY_STEP_ORDER.indexOf(left[0]);
        const rightIndex = JOURNEY_STEP_ORDER.indexOf(right[0]);
        return leftIndex - rightIndex;
      })
      .map(([journeyStep, topics]) => ({
        id: journeyStep,
        label: JOURNEY_STEP_LABELS[journeyStep],
        topics: [...topics].sort((left, right) => left.order - right.order)
      }));
  }, [selectableTopics]);

  const selectedSection = useMemo(
    () => extractSection(documentMarkdown, selectedTopic.docSection),
    [documentMarkdown, selectedTopic.docSection]
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await getHelpDocument();
        if (cancelled) {
          return;
        }
        setDocumentMarkdown(next.markdown);
      } catch (nextError) {
        if (cancelled) {
          return;
        }
        const detail = nextError instanceof Error ? nextError.message : String(nextError);
        setError(`Failed to load help document: ${detail}`);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setTopicSearchQuery((current) => (current === topicQuerySeed ? current : topicQuerySeed));
  }, [topicQuerySeed]);

  useEffect(() => {
    if (!selectedAnchor || loading || error) {
      return;
    }

    const decodedAnchor = decodeAnchorValue(selectedAnchor);
    const anchorCandidates = Array.from(
      new Set(
        [
          selectedAnchor,
          decodedAnchor,
          toHeadingId(selectedAnchor),
          toHeadingId(decodedAnchor)
        ].filter((candidate) => candidate.length > 0)
      )
    );

    const scrollToAnchor = () => {
      for (const candidate of anchorCandidates) {
        const target = document.getElementById(candidate);
        if (target) {
          target.scrollIntoView({ block: "start" });
          return true;
        }
      }

      const headings = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".help-page__content-card h1, .help-page__content-card h2, .help-page__content-card h3, .help-page__content-card h4, .help-page__content-card h5, .help-page__content-card h6"
        )
      );
      const matchingHeading = headings.find((heading) => {
        const text = heading.textContent ?? "";
        const headingId = toHeadingId(text);
        return anchorCandidates.includes(headingId);
      });
      if (!matchingHeading) {
        return false;
      }
      matchingHeading.scrollIntoView({ block: "start" });
      return true;
    };

    const timeout = window.setTimeout(() => {
      scrollToAnchor();
    }, 0);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [error, loading, selectedAnchor, selectedSection.markdown]);

  useEffect(() => {
    persistQuickStartChecklistState(quickStartChecklistState);
  }, [quickStartChecklistState]);

  const completedQuickStartItemCount = useMemo(
    () =>
      QUICK_START_CHECKLIST_ITEMS.filter((item) => quickStartChecklistState[item.id]).length,
    [quickStartChecklistState]
  );

  function handleQuickStartChecklistToggle(itemId: string, checked: boolean): void {
    setQuickStartChecklistState((current) => ({
      ...current,
      [itemId]: checked
    }));
  }

  function openQuickStartJourneyLink(link: QuickStartJourneyLink): void {
    setTopicSearchQuery("");
    setSearchParams(
      (current) => {
        const nextPath = buildHelpHashPath({ topic: link.topic, anchor: link.anchor });
        const queryIndex = nextPath.indexOf("?");
        const next = new URLSearchParams(current);
        const incoming = new URLSearchParams(queryIndex >= 0 ? nextPath.slice(queryIndex + 1) : "");
        next.set("topic", incoming.get("topic") ?? link.topic);
        const anchor = incoming.get("anchor");
        if (anchor) {
          next.set("anchor", anchor);
        } else {
          next.delete("anchor");
        }
        next.delete("q");
        return next;
      },
      { replace: true }
    );
  }

  if (loading) {
    return (
      <section className="help-page">
        <LoadingState label="Loading help center..." />
      </section>
    );
  }

  return (
    <section className="help-page">
      <header className="help-page__header">
        <Title2 as="h1" className="help-page__title">
          Help Center
        </Title2>
        <div className="help-page__topic-controls">
          <Input
            aria-label="Search help index"
            className="help-page__topic-search"
            placeholder="Search topic, keyword, or field..."
            value={topicSearchQuery}
            onChange={(_event, data) => {
              const nextQuery = data.value;
              setTopicSearchQuery(nextQuery);
              setSearchParams(
                (current) => {
                  const next = new URLSearchParams(current);
                  const trimmed = nextQuery.trim();
                  if (trimmed) {
                    next.set("q", trimmed);
                  } else {
                    next.delete("q");
                  }
                  return next;
                },
                { replace: true }
              );
            }}
          />
          <Select
            aria-label="Selected help topic"
            className="help-page__topic-select"
            value={selectedTopic.id}
            onChange={(event) => {
              const nextTopic = event.target.value;
              const nextTopicDefinition = resolveHelpTopic(nextTopic);
              setTopicSearchQuery("");
              setSearchParams(
                (current) => {
                  const next = new URLSearchParams(current);
                  next.set("topic", nextTopic);
                  if (nextTopicDefinition.defaultAnchor) {
                    next.set("anchor", nextTopicDefinition.defaultAnchor);
                  } else {
                    next.delete("anchor");
                  }
                  next.delete("q");
                  return next;
                },
                { replace: true }
              );
            }}
          >
            {selectableTopicGroups.map((group) => (
              <optgroup key={group.id} label={group.label}>
                {group.topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          {helpContext ? (
            <Text size={100} className="help-page__context-note">
              {`Context: ${helpContext}`}
            </Text>
          ) : null}
        </div>
      </header>

      {error ? <InlineError message={error} /> : null}

      {!error ? (
        <section className="help-page__content-card" data-testid="help-topic-content">
          {normalizedTopicSearchQuery.length > 0 ? (
            <section className="help-page__search-results" aria-label="Help jump results">
              <h3 className="help-page__search-results-heading">Jump Results</h3>
              {indexedTopics.length > 0 ? (
                <ul className="help-page__search-results-list">
                  {indexedTopics.slice(0, 6).map((topic) => (
                    <li key={topic.id}>
                      <button
                        className="help-page__search-result-button"
                        type="button"
                        onClick={() => {
                          setTopicSearchQuery("");
                          setSearchParams(
                            (current) => {
                              const next = new URLSearchParams(current);
                              next.set("topic", topic.id);
                              if (topic.defaultAnchor) {
                                next.set("anchor", topic.defaultAnchor);
                              } else {
                                next.delete("anchor");
                              }
                              next.delete("q");
                              return next;
                            },
                            { replace: true }
                          );
                        }}
                      >
                        <span className="help-page__search-result-title">{topic.title}</span>
                        <span className="help-page__search-result-snippet">{topic.inAppSnippet}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <Text size={200}>No help topics match the current search.</Text>
              )}
            </section>
          ) : null}
          {selectedTopic.id === "quick-start" ? (
            <section className="help-page__quick-start" aria-label="Quick start journey">
              <h3 className="help-page__quick-start-heading">First-Session Journey</h3>
              <Text size={200} className="help-page__quick-start-subtitle">
                {`${completedQuickStartItemCount}/${QUICK_START_CHECKLIST_ITEMS.length} setup milestones complete`}
              </Text>
              <ul className="help-page__quick-start-list">
                {QUICK_START_CHECKLIST_ITEMS.map((item) => (
                  <li key={item.id}>
                    <Checkbox
                      checked={quickStartChecklistState[item.id] === true}
                      label={item.label}
                      onChange={(_event, data) =>
                        handleQuickStartChecklistToggle(item.id, data.checked === true)
                      }
                    />
                  </li>
                ))}
              </ul>
              <div className="help-page__journey-links">
                {QUICK_START_JOURNEY_LINKS.map((link) => (
                  <Button
                    key={link.label}
                    appearance="secondary"
                    size="small"
                    type="button"
                    onClick={() => openQuickStartJourneyLink(link)}
                  >
                    {link.label}
                  </Button>
                ))}
              </div>
            </section>
          ) : null}
          {!selectedSection.found ? (
            <Text size={200} className="help-page__fallback-note">
              {`Couldn't find "${selectedTopic.docSection}" in the guide. Showing the full help document instead.`}
            </Text>
          ) : null}
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={MARKDOWN_COMPONENTS}
          >
            {selectedSection.markdown}
          </ReactMarkdown>
        </section>
      ) : null}
    </section>
  );
}
