"use client";

import { cn } from "@/lib/utils";

import styles from "./settings.module.css";

type SegmentOption = {
  label: string;
  value: string;
};

type SegmentedControlProps = {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
};

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <div className={styles.segmented}>
      {options.map((option) => (
        <button
          className={cn(styles.segmentedButton, value === option.value && styles.segmentedButtonActive)}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}