"use client";

import { cn } from "@/lib/utils";

import styles from "./settings.module.css";

type TagOption = {
  label: string;
  value: string;
};

type TagCloudProps = {
  options: TagOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  tone?: "green" | "orange" | "red";
};

const activeToneClass = {
  green: styles.tagGreenActive,
  orange: styles.tagOrangeActive,
  red: styles.tagRedActive
};

export function TagCloud({ options, selectedValues, onToggle, tone = "green" }: TagCloudProps) {
  return (
    <div className={styles.tagCloud}>
      {options.map((option) => {
        const active = selectedValues.includes(option.value);
        return (
          <button
            className={cn(styles.tagButton, active && activeToneClass[tone])}
            key={option.value}
            onClick={() => onToggle(option.value)}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}