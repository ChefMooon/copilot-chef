"use client";

import { useEffect, useState } from "react";

import { ModalShell } from "@/components/ui/ModalShell";

type CookingModeProps = {
  steps: string[];
  onClose: () => void;
  stepNumber: number;
  onStepNumberChange: (value: number) => void;
};

export function CookingMode({
  steps,
  onClose,
  stepNumber,
  onStepNumberChange,
}: CookingModeProps) {
  const [index, setIndex] = useState(Math.max(0, stepNumber - 1));

  useEffect(() => {
    setIndex(Math.max(0, stepNumber - 1));
  }, [stepNumber]);

  function setIndexAndStep(nextIndex: number) {
    setIndex(nextIndex);
    onStepNumberChange(nextIndex + 1);
  }

  return (
    <ModalShell
      ariaLabel="Cooking mode"
      bodyClassName="flex min-h-[calc(100vh-8rem)] flex-col justify-between bg-[rgba(44,36,22,0.72)] p-4 text-text md:p-6"
      closeLabel="Exit cooking mode"
      hideFooter
      onClose={onClose}
      open
      overlayClassName="p-0"
    >
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-between">
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
          <p className="mt-2 text-sm font-semibold text-text-muted">
            Step {index + 1} of {steps.length}
          </p>
          <p className="mt-4 font-serif text-[1.9rem] font-bold leading-[1.25] text-text">
            {steps[index]}
          </p>
        </div>
        <div className="mt-4 flex justify-between">
          <button
            className="rounded-[10px] border border-cream-dark bg-white px-3 py-2 text-[0.82rem] font-bold text-text-muted shadow-card transition-colors hover:border-green-light hover:text-green disabled:cursor-not-allowed disabled:opacity-50"
            disabled={index === 0}
            onClick={() => setIndexAndStep(Math.max(0, index - 1))}
            type="button"
          >
            Previous
          </button>
          <button
            className="rounded-[10px] bg-green px-3 py-2 text-[0.82rem] font-bold text-white shadow-card transition-colors hover:bg-green-light disabled:cursor-not-allowed disabled:opacity-50"
            disabled={index >= steps.length - 1}
            onClick={() =>
              setIndexAndStep(Math.min(steps.length - 1, index + 1))
            }
            type="button"
          >
            Next
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
