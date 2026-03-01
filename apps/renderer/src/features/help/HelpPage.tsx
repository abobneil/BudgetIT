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
  Select,
  Text,
  Title2
} from "@fluentui/react-components";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSearchParams } from "react-router-dom";

import { getHelpDocument } from "../../lib/ipcClient";
import { InlineError, LoadingState } from "../../ui/primitives";
import {
  HELP_TOPICS,
  resolveHelpTopic
} from "./help-topics";
import "./HelpPage.css";

type SectionExtraction = {
  markdown: string;
  found: boolean;
};

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
    node: _node,
    ...props
  }: HeadingProps & { node?: unknown }) {
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
  const selectedAnchor = searchParams.get("anchor")?.trim() ?? "";

  const selectedTopic = resolveHelpTopic(searchParams.get("topic"));

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
        <Select
          aria-label="Selected help topic"
          className="help-page__topic-select"
          value={selectedTopic.id}
          onChange={(event) =>
            setSearchParams(
              (current) => {
                const next = new URLSearchParams(current);
                next.set("topic", event.target.value);
                return next;
              },
              { replace: true }
            )
          }
        >
          {HELP_TOPICS.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.title}
            </option>
          ))}
        </Select>
      </header>

      {error ? <InlineError message={error} /> : null}

      {!error ? (
        <section className="help-page__content-card" data-testid="help-topic-content">
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
