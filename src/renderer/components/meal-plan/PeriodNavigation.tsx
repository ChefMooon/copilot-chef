import type { CSSProperties, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import styles from "./meal-plan.module.css";

type PeriodNavigationProps = {
  children: ReactNode;
  className: string;
  style?: CSSProperties;
  accentColor?: string;
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
};

export function PeriodNavigation({
  children,
  className,
  style,
  accentColor,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
}: PeriodNavigationProps) {
  return (
    <div className={`${styles.periodNav} ${className}`} style={style}>
      <button
        aria-label={previousLabel}
        className={styles.periodNavButton}
        onClick={onPrevious}
        type="button"
        title={previousLabel}
      >
        <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.8} />
      </button>
      <div className={styles.periodNavLabel}>{children}</div>
      <button
        aria-label={nextLabel}
        className={styles.periodNavButton}
        onClick={onNext}
        type="button"
        title={nextLabel}
      >
        <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} />
      </button>
      {accentColor ? (
        <span
          aria-hidden="true"
          className={styles.periodNavAccent}
          style={{ backgroundColor: accentColor }}
        />
      ) : null}
    </div>
  );
}