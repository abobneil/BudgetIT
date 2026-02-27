import type { ReactNode } from "react";
import { Button } from "@fluentui/react-components";

import { EmptyState } from "./EmptyState";
import { InlineError } from "./InlineError";
import { LoadingState } from "./LoadingState";

type PanelStateProps = {
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  loadingLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  onRetry?: () => void;
  children: ReactNode;
};

export function PanelState({
  loading,
  error,
  isEmpty,
  loadingLabel,
  emptyTitle,
  emptyDescription,
  onRetry,
  children
}: PanelStateProps) {
  if (loading) {
    return <LoadingState label={loadingLabel} />;
  }

  if (error) {
    return (
      <InlineError
        message={error}
        action={
          onRetry ? (
            <Button appearance="secondary" onClick={onRetry} size="small">
              Retry
            </Button>
          ) : undefined
        }
      />
    );
  }

  if (isEmpty) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return <>{children}</>;
}
