import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/ModalShell";
import { type RecipeIterationPayload } from "@/lib/api";

type DerivedRecipesModalProps = {
  open: boolean;
  iterations: RecipeIterationPayload[];
  onClose: () => void;
};

export function DerivedRecipesModal({
  open,
  iterations,
  onClose,
}: DerivedRecipesModalProps) {
  if (iterations.length <= 1) {
    return null;
  }

  return (
    <ModalShell
      ariaLabel="Derived recipes"
      bodyClassName="flex-1 overflow-y-auto px-3.5 py-3 sm:px-5 sm:py-4"
      className="max-w-xl"
      closeLabel="Close derived recipes dialog"
      footerRight={
        <Button onClick={onClose} type="button" variant="outline">
          Close
        </Button>
      }
      eyebrow="Recipe Lineage"
      onClose={onClose}
      open={open}
      title="Derived Recipes"
    >
      <ul className="space-y-2">
        {iterations.map((iteration) => (
          <li key={iteration.id}>
            <Link
              className="block rounded-[10px] border border-cream-dark bg-cream px-3 py-2 text-[0.92rem] font-semibold text-green transition-colors hover:border-green-light hover:bg-green-pale"
              onClick={onClose}
              style={{
                paddingLeft: `${0.75 + Math.max(0, iteration.depth - 1) * 1.1}rem`,
              }}
              to={`/recipes/${iteration.id}`}
            >
              {iteration.title}
            </Link>
          </li>
        ))}
      </ul>
    </ModalShell>
  );
}
