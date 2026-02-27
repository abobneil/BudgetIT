import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { Button, Card, Text } from "@fluentui/react-components";

type ErrorBoundaryProps = {
  children: ReactNode;
  label?: string;
  resetKey?: string | number;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const label = this.props.label ?? "UI boundary";
    console.error(`[${label}]`, error, info.componentStack);
  }

  private readonly handleRetry = (): void => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <Card
        role="alert"
        style={{
          padding: "1rem",
          display: "grid",
          gap: "0.5rem"
        }}
      >
        <Text weight="semibold">{this.props.label ?? "Something went wrong"}</Text>
        <Text>{this.state.error.message}</Text>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button appearance="primary" onClick={this.handleRetry} size="small">
            Retry
          </Button>
          <Button
            appearance="secondary"
            onClick={() => window.location.reload()}
            size="small"
          >
            Reload app
          </Button>
        </div>
      </Card>
    );
  }
}
