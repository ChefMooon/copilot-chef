import { useEffect, useRef, useState } from "react";

import { SLASH_COMMANDS, type SlashCommand } from "./slash-commands";
import styles from "./ChatPanel.module.css";

interface SlashCommandMenuProps {
  query: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}

export function SlashCommandMenu({
  query,
  onSelect,
  onClose,
}: SlashCommandMenuProps) {
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.command.includes(query.toLowerCase()) ||
      cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!filtered.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((prev) => (prev + 1) % filtered.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (filtered[cursor]) onSelect(filtered[cursor]);
      } else if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cursor, filtered, onSelect, onClose]);

  if (!filtered.length) return null;

  return (
    <ul
      aria-label="Available commands"
      className={styles.slashMenu}
      ref={listRef}
      role="listbox"
    >
      {filtered.map((cmd, index) => (
        <li
          aria-selected={index === cursor}
          className={`${styles.slashMenuItem} ${index === cursor ? styles.slashMenuItemActive : ""}`}
          key={cmd.command}
          onClick={() => onSelect(cmd)}
          role="option"
        >
          <span className={styles.slashCommand}>{cmd.command}</span>
          <span className={styles.slashDescription}>{cmd.description}</span>
        </li>
      ))}
    </ul>
  );
}
