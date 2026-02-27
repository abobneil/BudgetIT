import type { ReactNode } from "react";
import { Card, Text } from "@fluentui/react-components";

type InlineErrorProps = {
  message: string;
  title?: string;
  action?: ReactNode;
};

export function InlineError({
  message,
  title = "Something went wrong",
  action
}: InlineErrorProps) {
  return (
    <Card
      style={{
        borderLeft: "4px solid #cf222e",
        padding: "0.75rem 1rem",
        display: "grid",
        gap: "0.5rem"
      }}
    >
      <Text weight="semibold">{title}</Text>
      <Text>{message}</Text>
      {action ? <div>{action}</div> : null}
    </Card>
  );
}
