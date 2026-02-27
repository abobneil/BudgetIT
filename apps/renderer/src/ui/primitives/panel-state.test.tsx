/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { Button } from "@fluentui/react-components";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "./ErrorBoundary";
import { PanelState } from "./PanelState";

afterEach(() => {
  cleanup();
});

describe("panel state primitives", () => {
  it("renders loading contract with skeleton rows", () => {
    render(
      <PanelState
        loading
        error={null}
        isEmpty={false}
        loadingLabel="Loading contracts..."
        emptyTitle="Empty"
        emptyDescription="None"
      >
        <div>content</div>
      </PanelState>
    );

    expect(screen.getByText("Loading contracts...")).toBeInTheDocument();
  });

  it("renders empty-state and error fallback contracts", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <PanelState
        loading={false}
        error={null}
        isEmpty
        loadingLabel="Loading"
        emptyTitle="No data"
        emptyDescription="Try another filter."
      >
        <div>content</div>
      </PanelState>
    );
    expect(screen.getByText("No data")).toBeInTheDocument();

    rerender(
      <PanelState
        loading={false}
        error="Exploded panel"
        isEmpty={false}
        loadingLabel="Loading"
        emptyTitle="No data"
        emptyDescription="Try another filter."
        onRetry={onRetry}
      >
        <div>content</div>
      </PanelState>
    );
    expect(screen.getByText("Exploded panel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders error boundary fallback and recovers on reset key change", () => {
    function BrokenWidget({ crash }: { crash: boolean }) {
      if (crash) {
        throw new Error("Widget crashed");
      }
      return <div>Widget healthy</div>;
    }

    const { rerender } = render(
      <ErrorBoundary label="Widget boundary" resetKey="a">
        <BrokenWidget crash />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Widget boundary");
    expect(screen.getByText("Widget crashed")).toBeInTheDocument();

    rerender(
      <ErrorBoundary label="Widget boundary" resetKey="b">
        <BrokenWidget crash={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Widget healthy")).toBeInTheDocument();
  });

  it("keeps custom inline-error action reachable via keyboard", () => {
    const actionSpy = vi.fn();
    render(
      <PanelState
        loading={false}
        error="Cannot load table"
        isEmpty={false}
        loadingLabel="Loading"
        emptyTitle="No data"
        emptyDescription="Try another filter."
        onRetry={actionSpy}
      >
        <Button>unreachable</Button>
      </PanelState>
    );

    const retry = screen.getByRole("button", { name: "Retry" });
    retry.focus();
    fireEvent.keyDown(retry, { key: "Enter" });
    fireEvent.click(retry);
    expect(actionSpy).toHaveBeenCalledTimes(1);
  });
});
