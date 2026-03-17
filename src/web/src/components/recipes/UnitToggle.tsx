import { type UnitMode } from "@/lib/recipe-units";

type UnitToggleProps = {
  value: UnitMode;
  onChange: (value: UnitMode) => void;
};

export function UnitToggle({ value, onChange }: UnitToggleProps) {
  return (
    <div className="inline-flex rounded-[10px] border border-cream-dark bg-cream p-1">
      {(["cup", "grams"] as const).map((mode) => (
        <button
          key={mode}
          className={`rounded-[8px] px-3 py-1 text-[0.78rem] font-bold transition-colors ${
            value === mode
              ? "bg-green text-white"
              : "text-text-muted hover:bg-green-pale hover:text-green"
          }`}
          onClick={() => onChange(mode)}
          type="button"
        >
          {mode === "cup" ? "Cup" : "Grams"}
        </button>
      ))}
    </div>
  );
}
