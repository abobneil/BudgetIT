import type { ReactNode } from "react";
import { Card, Text } from "@fluentui/react-components";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card style={{ padding: "1rem", gap: "0.5rem" }}>
      <Text weight="semibold">{title}</Text>
      <Text style={{ color: "#57606a" }}>{description}</Text>
      {action ? <div>{action}</div> : null}
    </Card>
  );
}
