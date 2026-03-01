import type { ReactNode } from "react";
import { Text, Title2 } from "@fluentui/react-components";

import { ContextHelpButton } from "./ContextHelpButton";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  helpTopic?: string;
  helpAnchor?: string;
  helpLabel?: string;
};

export function PageHeader({
  title,
  subtitle,
  actions,
  helpTopic,
  helpAnchor,
  helpLabel
}: PageHeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "0.75rem"
      }}
    >
      <div>
        <Title2 style={{ margin: 0 }}>{title}</Title2>
        {subtitle ? (
          <Text style={{ color: "#57606a", display: "block", marginTop: "0.25rem" }}>
            {subtitle}
          </Text>
        ) : null}
      </div>
      {actions || helpTopic ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem"
          }}
        >
          {actions ? <div>{actions}</div> : null}
          {helpTopic ? (
            <ContextHelpButton
              topic={helpTopic}
              anchor={helpAnchor}
              label={helpLabel}
            />
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
