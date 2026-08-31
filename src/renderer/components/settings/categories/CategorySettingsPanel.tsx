import type { ReactNode } from "react";

import styles from "../settings.module.css";

export type CategorySettingsPanelProps = {
  active: boolean;
  ariaLabelledBy: string;
  description: string;
  id: string;
  children: ReactNode;
};

export function CategorySettingsPanel({
  active,
  ariaLabelledBy,
  children,
  description,
  id,
}: CategorySettingsPanelProps) {
  return (
    <div
      aria-labelledby={ariaLabelledBy}
      className={styles.tabPanel}
      hidden={!active}
      id={id}
      role="tabpanel"
    >
      <p className={styles.tabDescription}>{description}</p>
      {children}
    </div>
  );
}