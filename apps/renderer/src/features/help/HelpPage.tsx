import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Input,
  Select,
  Text,
  Title3
} from "@fluentui/react-components";
import { useSearchParams } from "react-router-dom";

import { getHelpDocument } from "../../lib/ipcClient";
import { InlineError, LoadingState, PageHeader } from "../../ui/primitives";
import {
  HELP_TOPICS,
  resolveHelpTopic
} from "./help-topics";
import "./HelpPage.css";

function extractSection(markdown: string, sectionHeading: string): string {
  const lines = markdown.split(/\r?\n/);
  const headingLine = `## ${sectionHeading}`;
  const sectionStart = lines.findIndex(
    (line) => line.trim() === headingLine
  );
  if (sectionStart < 0) {
    return markdown;
  }

  let sectionEnd = lines.length;
  for (let index = sectionStart + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      sectionEnd = index;
      break;
    }
  }
  return lines.slice(sectionStart, sectionEnd).join("\n").trim();
}

export function HelpPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [topicFilter, setTopicFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentMarkdown, setDocumentMarkdown] = useState("");
  const [documentSourcePath, setDocumentSourcePath] = useState<string | null>(null);

  const selectedTopic = resolveHelpTopic(searchParams.get("topic"));
  const filteredTopics = useMemo(() => {
    const normalized = topicFilter.trim().toLowerCase();
    if (!normalized) {
      return HELP_TOPICS;
    }
    return HELP_TOPICS.filter(
      (topic) =>
        topic.title.toLowerCase().includes(normalized) ||
        topic.inAppSnippet.toLowerCase().includes(normalized) ||
        topic.docSection.toLowerCase().includes(normalized)
    );
  }, [topicFilter]);

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
        setDocumentSourcePath(next.sourcePath);
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

  if (loading) {
    return (
      <section className="help-page">
        <LoadingState label="Loading help center..." />
      </section>
    );
  }

  return (
    <section className="help-page">
      <PageHeader
        title="Help Center"
        subtitle="Contextual guidance and full documentation for BudgetIT workflows."
      />

      {error ? <InlineError message={error} /> : null}

      <Card>
        <Title3>Choose Help Topic</Title3>
        <div className="help-page__topic-controls">
          <Input
            aria-label="Filter help topics"
            placeholder="Filter topics"
            value={topicFilter}
            onChange={(_event, data) => setTopicFilter(data.value)}
          />
          <Select
            aria-label="Selected help topic"
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
            {filteredTopics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        <Title3>{selectedTopic.title}</Title3>
        <Text>{selectedTopic.inAppSnippet}</Text>
        <Text size={200}>{`Guide section: ${selectedTopic.docSection}`}</Text>
      </Card>

      <Card>
        <Title3>Guide Excerpt</Title3>
        <pre className="help-page__markdown" data-testid="help-topic-excerpt">
          {selectedSection}
        </pre>
      </Card>

      <Card>
        <Title3>Full Help Document</Title3>
        {documentSourcePath ? (
          <Text size={200}>{`Source: ${documentSourcePath}`}</Text>
        ) : null}
        <details>
          <summary>Show full document</summary>
          <pre className="help-page__markdown">{documentMarkdown}</pre>
        </details>
      </Card>
    </section>
  );
}
