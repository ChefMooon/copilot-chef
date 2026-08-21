import type { CSSProperties, ReactNode } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

import styles from "./meal-plan.module.css";

type PeriodNavigationProps = {
  children: ReactNode;
  className: string;
  style?: CSSProperties;
  accentColor?: string;
  previousLabel: string;
  nextLabel: string;
  onPrevious?: () => void;
  onNext: () => void;
  showPrevious?: boolean;
  currentLabel?: string;
  currentDisabled?: boolean;
  onCurrent?: () => void;
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
  showPrevious = true,
  currentLabel,
  currentDisabled = false,
  onCurrent,
}: PeriodNavigationProps) {
  return (
    <div className={`${styles.periodNav} ${className}`} style={style}>
      {showPrevious && onPrevious ? (
        <button
          aria-label={previousLabel}
          className={styles.periodNavButton}
          onClick={onPrevious}
          type="button"
          title={previousLabel}
        >
          <CaretLeft aria-hidden="true" size={18} weight="regular" />
        </button>
      ) : null}
      <div className={styles.periodNavLabel}>{children}</div>
      <div className={styles.periodNavActions}>
        {currentLabel && onCurrent ? (
          <button
            aria-label={currentLabel}
            className={styles.periodNavCurrentButton}
            disabled={currentDisabled}
            onClick={onCurrent}
            type="button"
            title={currentLabel}
          >
            {currentLabel}
          </button>
        ) : null}
        <button
          aria-label={nextLabel}
          className={styles.periodNavButton}
          onClick={onNext}
          type="button"
          title={nextLabel}
        >
          <CaretRight aria-hidden="true" size={18} weight="regular" />
        </button>
      </div>
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