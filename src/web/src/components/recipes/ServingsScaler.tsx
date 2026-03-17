import { type UnitMode } from "@/lib/recipe-units";

import { UnitToggle } from "./UnitToggle";

type ServingsScalerProps = {
  baseServings: number;
  servings: number;
  unitMode: UnitMode;
  onServingsChange: (value: number) => void;
  onUnitModeChange: (value: UnitMode) => void;
};

export function ServingsScaler(props: ServingsScalerProps) {
  return (
    <div className="mb-1 flex flex-wrap items-center gap-4 rounded-[14px] border border-[rgba(59,94,69,0.1)] bg-white p-3.5 shadow-card">
      <div className="flex items-center gap-2">
        <button
          className="h-8 w-8 rounded-[8px] border border-cream-dark bg-cream text-sm font-bold text-text transition-colors hover:border-green-light hover:text-green"
          onClick={() => props.onServingsChange(Math.max(1, props.servings - 1))}
          type="button"
        >
          -
        </button>
        <input
          className="w-16 rounded-[8px] border border-cream-dark bg-cream px-2 py-1 text-center font-semibold text-text outline-none transition-colors focus:border-green focus:ring-2 focus:ring-green/20"
          min={1}
          onChange={(event) =>
            props.onServingsChange(Math.max(1, Number(event.target.value) || 1))
          }
          type="number"
          value={props.servings}
        />
        <button
          className="h-8 w-8 rounded-[8px] border border-cream-dark bg-cream text-sm font-bold text-text transition-colors hover:border-green-light hover:text-green"
          onClick={() => props.onServingsChange(props.servings + 1)}
          type="button"
        >
          +
        </button>
        <span className="text-[0.78rem] font-semibold text-text-muted">base: {props.baseServings}</span>
      </div>
      <UnitToggle onChange={props.onUnitModeChange} value={props.unitMode} />
    </div>
  );
}
