import { Card, Text } from "@fluentui/react-components";

type InlineErrorProps = {
  message: string;
};

export function InlineError({ message }: InlineErrorProps) {
  return (
    <Card
      style={{
        borderLeft: "4px solid #cf222e",
        padding: "0.75rem 1rem"
      }}
    >
      <Text weight="semibold">Something went wrong</Text>
      <Text style={{ display: "block", marginTop: "0.25rem" }}>{message}</Text>
    </Card>
  );
}
