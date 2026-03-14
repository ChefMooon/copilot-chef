"use client";

import { cn } from "@/lib/utils";

import styles from "./settings.module.css";

type PersonaOption = {
  value: string;
  icon: string;
  name: string;
  subtitle: string;
  isCustom?: boolean;
};

type PersonaGridProps = {
  options: PersonaOption[];
  value: string;
  onSelect: (value: string) => void;
  onCreateCustom?: () => void;
  onEditCustom?: (value: string) => void;
};

export function PersonaGrid({
  options,
  value,
  onSelect,
  onCreateCustom,
  onEditCustom,
}: PersonaGridProps) {
  return (
    <div className={styles.personaGrid}>
      {options.map((option) => (
        <button
          className={cn(
            styles.personaCard,
            value === option.value && styles.personaCardActive
          )}
          key={option.value}
          onClick={() => onSelect(option.value)}
          type="button"
        >
          {option.isCustom && onEditCustom && (
            <button
              className={styles.personaEditBtn}
              onClick={(e) => {
                e.stopPropagation();
                onEditCustom(option.value);
              }}
              title="Edit persona"
              type="button"
            >
              ✎
            </button>
          )}
          <span className={styles.personaIcon}>{option.icon}</span>
          <span className={styles.personaName}>{option.name}</span>
          <span className={styles.personaSubtitle}>{option.subtitle}</span>
        </button>
      ))}

      {onCreateCustom && (
        <button
          className={cn(styles.personaCard, styles.personaCardAdd)}
          onClick={onCreateCustom}
          type="button"
        >
          <span className={styles.personaAddIcon}>+</span>
          <span className={styles.personaName}>Create custom</span>
          <span className={styles.personaSubtitle}>Your own chef voice</span>
        </button>
      )}
    </div>
  );
}
