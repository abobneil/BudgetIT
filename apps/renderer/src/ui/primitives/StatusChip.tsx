import { Badge } from "@fluentui/react-components";

type StatusChipTone = "info" | "success" | "warning" | "danger";

type StatusChipProps = {
  label: string;
  tone?: StatusChipTone;
};

const toneToColor: Record<
  StatusChipTone,
  "brand" | "success" | "warning" | "danger"
> = {
  info: "brand",
  success: "success",
  warning: "warning",
  danger: "danger"
};

export function StatusChip({ label, tone = "info" }: StatusChipProps) {
  return (
    <Badge appearance="filled" color={toneToColor[tone]}>
      {label}
    </Badge>
  );
}
