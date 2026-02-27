import {
  Button,
  Text,
  Title3
} from "@fluentui/react-components";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";

import "./FeedbackProvider.css";

export type FeedbackTone = "success" | "error" | "info" | "warning";

type FeedbackItem = {
  id: string;
  tone: FeedbackTone;
  message: string;
  title?: string;
};

type NotifyOptions = {
  tone: FeedbackTone;
  message: string;
  title?: string;
  durationMs?: number;
};

type FeedbackContextValue = {
  notify: (options: NotifyOptions) => void;
  dismiss: (id: string) => void;
};

const noop = () => {
  return;
};

const FeedbackContext = createContext<FeedbackContextValue>({
  notify: noop,
  dismiss: noop
});

function createFeedbackId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `feedback-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function FeedbackProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const timersRef = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    ({ tone, message, title, durationMs }: NotifyOptions) => {
      const id = createFeedbackId();
      const next: FeedbackItem = { id, tone, message, title };
      setItems((current) => [next, ...current].slice(0, 6));

      const timeoutMs = durationMs ?? (tone === "error" ? 7000 : 4500);
      const timer = window.setTimeout(() => {
        dismiss(id);
      }, timeoutMs);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        window.clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo<FeedbackContextValue>(
    () => ({
      notify,
      dismiss
    }),
    [dismiss, notify]
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <section className="feedback-viewport" aria-label="Notifications" aria-live="polite">
        {items.map((item) => (
          <article
            key={item.id}
            className={`feedback-toast feedback-toast--${item.tone}`}
            role={item.tone === "error" ? "alert" : "status"}
          >
            <div className="feedback-toast__header">
              <Title3 style={{ margin: 0, fontSize: "0.95rem" }}>
                {item.title ??
                  (item.tone === "error"
                    ? "Action failed"
                    : item.tone === "success"
                      ? "Action complete"
                      : "Update")}
              </Title3>
              <Button
                appearance="transparent"
                aria-label="Dismiss notification"
                onClick={() => dismiss(item.id)}
                size="small"
              >
                Dismiss
              </Button>
            </div>
            <Text>{item.message}</Text>
          </article>
        ))}
      </section>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  return useContext(FeedbackContext);
}
