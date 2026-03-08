import { Button } from "@fluentui/react-components";

import { EmptyState, PageHeader } from "../../ui/primitives";

export function DeveloperToolsPage() {
  return (
    <section style={{ padding: "1rem 1.25rem" }}>
      <PageHeader
        title="Developer Tools"
        subtitle="Legacy workspace flows have been retired from the shipped app shell."
      />
      <div style={{ marginTop: "1rem" }}>
        <EmptyState
          title="Developer tools are limited to diagnostics"
          description="The legacy monolithic workspace is no longer exposed from /developer. Use the routed workspaces for BudgetIT features and the package test/build commands for diagnostics."
          action={
            <Button appearance="secondary" size="small" disabled>
              Routed workspaces are now canonical
            </Button>
          }
        />
      </div>
    </section>
  );
}

