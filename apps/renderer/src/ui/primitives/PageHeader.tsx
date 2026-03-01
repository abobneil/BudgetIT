import type { ReactNode } from "react";
import { Text, Title2 } from "@fluentui/react-components";

import "./PageHeader.css";

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
    <header className="page-header">
      <div className="page-header__content">
        <Title2 className="page-header__title">{title}</Title2>
        {subtitle ? (
          <Text className="page-header__subtitle">
            {subtitle}
          </Text>
        ) : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
