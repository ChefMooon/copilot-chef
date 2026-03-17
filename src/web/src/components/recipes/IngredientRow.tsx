type IngredientRowProps = {
  display: string;
  notes?: string | null;
};

export function IngredientRow({ display, notes }: IngredientRowProps) {
  return (
    <li className="flex items-start justify-between gap-2 py-2 text-[0.9rem] text-text">
      <span>{display}</span>
      {notes ? <span className="text-[0.78rem] font-semibold text-text-muted">{notes}</span> : null}
    </li>
  );
}
