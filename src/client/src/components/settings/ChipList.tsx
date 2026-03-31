"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import styles from "./settings.module.css";

type ChipListProps = {
  title: string;
  description: string;
  placeholder: string;
  items: string[];
  onAdd: (values: string[]) => void;
  onRemove: (value: string) => void;
  onReorder: (values: string[]) => void;
};

function parseInput(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ChipList({
  title,
  description,
  placeholder,
  items,
  onAdd,
  onRemove,
  onReorder,
}: ChipListProps) {
  const [inputValue, setInputValue] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const submit = () => {
    const parsed = parseInput(inputValue);
    if (parsed.length === 0) {
      return;
    }
    onAdd(parsed);
    setInputValue("");
  };

  return (
    <div className={styles.chipColumn}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleRow}>
          <h3 className={styles.cardTitle}>{title}</h3>
        </div>
        <p className={styles.cardDescription}>{description}</p>
      </div>

      <div className={styles.chipInputRow}>
        <input
          className={styles.textInput}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          type="text"
          value={inputValue}
        />
        <Button onClick={submit} type="button" variant="outline">
          Add
        </Button>
      </div>

      <div className={styles.chipList}>
        {items.length === 0 ? (
          <div className={styles.chipEmpty}>Nothing added yet.</div>
        ) : null}
        {items.map((item, index) => (
          <div
            className={cn(
              styles.chip,
              dragIndex === index && styles.chipDragging,
              dragOverIndex === index && styles.chipDragOver
            )}
            draggable
            key={`${item}-${index}`}
            onDragEnd={() => {
              setDragIndex(null);
              setDragOverIndex(null);
            }}
            onDragLeave={() =>
              setDragOverIndex((current) =>
                current === index ? null : current
              )
            }
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverIndex(index);
            }}
            onDragStart={() => setDragIndex(index)}
            onDrop={(event) => {
              event.preventDefault();
              if (dragIndex === null || dragIndex === index) {
                setDragOverIndex(null);
                return;
              }

              const next = [...items];
              const [dragged] = next.splice(dragIndex, 1);
              next.splice(index, 0, dragged);
              setDragIndex(null);
              setDragOverIndex(null);
              onReorder(next);
            }}
          >
            <span className={styles.chipHandle}>⠿</span>
            <span className={styles.chipLabel}>{item}</span>
            <button
              className={styles.chipRemove}
              onClick={() => onRemove(item)}
              type="button"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
