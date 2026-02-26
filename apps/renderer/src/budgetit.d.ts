declare global {
  interface Window {
    budgetit?: {
      invoke: (channel: string, payload?: unknown) => Promise<unknown>;
    };
  }
}

export {};

