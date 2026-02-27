declare global {
  interface Window {
    budgetit?: {
      invoke: (channel: string, payload?: unknown) => Promise<unknown>;
      onAlertNavigate?: (
        listener: (payload: { alertEventId: string; entityType: string; entityId: string }) => void
      ) => () => void;
    };
  }
}

export {};

