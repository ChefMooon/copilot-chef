"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import styles from "./settings.module.css";

type CollapsibleSectionProps = {
  id: string;
  label: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function CollapsibleSection({
  id,
  label,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const storageKey = `settings-section-${id}`;
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [contentHeight, setContentHeight] = useState(0);
  const contentInnerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const node = contentInnerRef.current;
    if (!node) {
      return;
    }

    const updateHeight = () => {
      setContentHeight(node.scrollHeight);
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateHeight();
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [children, isOpen]);

  return (
    <section className={styles.section}>
      <button
        className={styles.sectionButton}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <ChevronDown
          className={cn(
            styles.sectionChevron,
            !isOpen && styles.sectionChevronClosed
          )}
          size={18}
        />
        <span className={styles.sectionLabel}>{label}</span>
        <span aria-hidden className={styles.sectionRule} />
      </button>
      <div
        className={cn(
          styles.sectionContent,
          !isOpen && styles.sectionContentClosed
        )}
        style={{ maxHeight: isOpen ? `${contentHeight}px` : undefined }}
      >
        <div className={styles.sectionInner} ref={contentInnerRef}>{children}</div>
      </div>
    </section>
  );
}
