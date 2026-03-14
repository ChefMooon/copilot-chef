"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import styles from "./settings.module.css";

type CollapsibleSectionProps = {
  id: string;
  label: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function CollapsibleSection({ id, label, defaultOpen = true, children }: CollapsibleSectionProps) {
  const storageKey = `settings-section-${id}`;
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored !== null) {
        setIsOpen(stored === "true");
      }
    } catch {
      // ignore storage failures
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(isOpen));
    } catch {
      // ignore storage failures
    }
  }, [isOpen, storageKey]);

  return (
    <section className={styles.section}>
      <button className={styles.sectionButton} onClick={() => setIsOpen((open) => !open)} type="button">
        <ChevronDown className={cn(styles.sectionChevron, !isOpen && styles.sectionChevronClosed)} size={18} />
        <span className={styles.sectionLabel}>{label}</span>
        <span aria-hidden className={styles.sectionRule} />
      </button>
      <div className={cn(styles.sectionContent, !isOpen && styles.sectionContentClosed)}>
        <div className={styles.sectionInner}>{children}</div>
      </div>
    </section>
  );
}