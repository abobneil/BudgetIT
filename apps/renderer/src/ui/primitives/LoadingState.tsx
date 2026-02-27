import { Card, Text } from "@fluentui/react-components";

type LoadingStateProps = {
  label?: string;
  rows?: number;
};

export function LoadingState({
  label = "Loading...",
  rows = 4
}: LoadingStateProps) {
  return (
    <Card
      aria-live="polite"
      style={{
        padding: "1rem",
        display: "grid",
        gap: "0.5rem"
      }}
    >
      <Text weight="semibold">{label}</Text>
      <div
        style={{
          display: "grid",
          gap: "0.4rem"
        }}
      >
        {Array.from({ length: Math.max(rows, 1) }).map((_, index) => (
          <div
            key={index}
            aria-hidden
            style={{
              height: "0.7rem",
              borderRadius: "999px",
              width: index % 3 === 0 ? "82%" : index % 2 === 0 ? "65%" : "100%",
              background: "linear-gradient(90deg, #e5e7eb 0%, #f3f4f6 45%, #e5e7eb 100%)",
              backgroundSize: "220% 100%",
              animation: "budgetit-loading-wave 1.3s ease-in-out infinite"
            }}
          />
        ))}
      </div>
    </Card>
  );
}
