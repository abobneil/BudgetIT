import { Button } from "@fluentui/react-components";

import { EmptyState, PageHeader } from "../../ui/primitives";

type FeaturePlaceholderPageProps = {
  title: string;
  description: string;
};

export function FeaturePlaceholderPage({
  title,
  description
}: FeaturePlaceholderPageProps) {
  return (
    <section style={{ padding: "1rem 1.25rem" }}>
      <PageHeader title={title} subtitle={description} />
      <div style={{ marginTop: "1rem" }}>
        <EmptyState
          title={`${title} workspace is being upgraded`}
          description="This page has been scaffolded and moved into the routed app shell. Feature-specific workflows will be completed in the next UI issues."
          action={
            <Button appearance="secondary" size="small">
              See Implementation Plan
            </Button>
          }
        />
      </div>
    </section>
  );
}

