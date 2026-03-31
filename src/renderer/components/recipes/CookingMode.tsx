"use client";

import { useState } from "react";

type CookingModeProps = {
  steps: string[];
  onClose: () => void;
};

export function CookingMode({ steps, onClose }: CookingModeProps) {
  const [index, setIndex] = useState(0);

  return (
    <div className="fixed inset-0 z-[700] bg-[rgba(44,36,22,0.72)] p-4 text-text md:p-6">
      <div className="mx-auto flex h-full max-w-3xl flex-col justify-between">
        <div className="rounded-[18px] border border-[rgba(59,94,69,0.12)] bg-white p-5 shadow-lg md:p-6">
          <button
            className="mb-6 rounded-[10px] border border-cream-dark bg-cream px-3 py-2 text-[0.82rem] font-bold text-text-muted transition-colors hover:border-green-light hover:text-green"
            onClick={onClose}
            type="button"
          >
            Exit cooking mode
          </button>
          <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-orange">
            Cooking Mode
          </p>
          <p className="mt-2 text-sm font-semibold text-text-muted">Step {index + 1} of {steps.length}</p>
          <p className="mt-4 font-serif text-[1.9rem] font-bold leading-[1.25] text-text">{steps[index]}</p>
        </div>
        <div className="mt-4 flex justify-between">
          <button
            className="rounded-[10px] border border-cream-dark bg-white px-3 py-2 text-[0.82rem] font-bold text-text-muted shadow-card transition-colors hover:border-green-light hover:text-green disabled:cursor-not-allowed disabled:opacity-50"
            disabled={index === 0}
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
            type="button"
          >
            Previous
          </button>
          <button
            className="rounded-[10px] bg-green px-3 py-2 text-[0.82rem] font-bold text-white shadow-card transition-colors hover:bg-green-light disabled:cursor-not-allowed disabled:opacity-50"
            disabled={index >= steps.length - 1}
            onClick={() =>
              setIndex((current) => Math.min(steps.length - 1, current + 1))
            }
            type="button"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
