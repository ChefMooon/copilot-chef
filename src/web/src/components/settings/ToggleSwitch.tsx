"use client";

import { cn } from "@/lib/utils";

import styles from "./settings.module.css";

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function ToggleSwitch({ checked, onChange, disabled = false }: ToggleSwitchProps) {
  return (
    <button
      aria-checked={checked}
      className={cn(styles.switch, checked && styles.switchChecked)}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span className={styles.switchThumb} />
    </button>
  );
}