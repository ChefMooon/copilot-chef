"use client";

import { cn } from "@/lib/utils";

import styles from "./settings.module.css";

type PersonaOption = {
  value: string;
  icon: string;
  name: string;
  subtitle: string;
};

type PersonaGridProps = {
  options: PersonaOption[];
  value: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
};

export function PersonaGrid({ options, value, onSelect, disabled = false }: PersonaGridProps) {
  return (
    <div className={styles.personaGrid}>
      {options.map((option) => (
        <button
          aria-disabled={disabled}
          className={cn(
            styles.personaCard,
            value === option.value && styles.personaCardActive,
            disabled && styles.personaCardDisabled
          )}
          key={option.value}
          onClick={() => onSelect(option.value)}
          type="button"
        >
          <span className={styles.personaIcon}>{option.icon}</span>
          <span className={styles.personaName}>{option.name}</span>
          <span className={styles.personaSubtitle}>{option.subtitle}</span>
        </button>
      ))}
    </div>
  );
}