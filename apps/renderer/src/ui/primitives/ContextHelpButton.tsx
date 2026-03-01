import { Button } from "@fluentui/react-components";

import { resolveHelpTopic } from "../../features/help/help-topics";
import { openHelpWindow } from "../../lib/ipcClient";

type ContextHelpButtonProps = {
  topic: string;
  anchor?: string;
  label?: string;
  className?: string;
  size?: "small" | "medium" | "large";
  appearance?: "secondary" | "subtle" | "transparent";
};

export function ContextHelpButton({
  topic,
  anchor,
  label = "(?)",
  className,
  size = "small",
  appearance = "subtle"
}: ContextHelpButtonProps) {
  const resolved = resolveHelpTopic(topic);

  return (
    <Button
      appearance={appearance}
      className={className}
      aria-label={`Open help: ${resolved.title}`}
      title={`Open help: ${resolved.title}`}
      size={size}
      onClick={() => {
        void openHelpWindow({
          topic: resolved.id,
          anchor
        });
      }}
      type="button"
    >
      {label}
    </Button>
  );
}

