import type { ReactNode } from "react";
import { Text, Title2 } from "@fluentui/react-components";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({
  title,
  subtitle,
  actions
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
      {actions ? <div>{actions}</div> : null}
    </header>
  );
}
