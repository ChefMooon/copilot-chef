"use client";

import { cn } from "@/lib/utils";

import styles from "./settings.module.css";

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  labelId?: string;
};

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  id,
  labelId,
}: ToggleSwitchProps) {
  return (
    <button
      aria-checked={checked}
      aria-labelledby={labelId}
      className={cn(styles.switch, checked && styles.switchChecked)}
      disabled={disabled}
      id={id}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span className={styles.switchThumb} />
    </button>
  );
}
