export type InstructionAnnotationCandidate = {
  ingredientId: string;
  ingredientName: string;
  amountText: string | null;
};

export type AnnotatedInstructionPart =
  | {
      type: "text";
      value: string;
    }
  | {
      type: "match";
      ingredientId: string;
      text: string;
      amountText: string;
    };

export type AnnotatedInstructionStep = {
  parts: AnnotatedInstructionPart[];
  matchedIngredientIds: string[];
};

type InstructionMatch = {
  ingredientId: string;
  start: number;
  end: number;
  text: string;
  amountText: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createIngredientPattern(ingredientName: string) {
  const tokens = ingredientName
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => escapeRegExp(token));

  if (tokens.length === 0) {
    return null;
  }

  const body = tokens.join("[\\s-]+");
  return new RegExp(`(^|[^a-z0-9])(${body})(?=$|[^a-z0-9])`, "gi");
}

function overlaps(existingMatches: InstructionMatch[], start: number, end: number) {
  return existingMatches.some(
    (match) => start < match.end && end > match.start
  );
}

export function annotateInstructionSteps(
  instructions: string[],
  candidates: InstructionAnnotationCandidate[]
): AnnotatedInstructionStep[] {
  const usableCandidates = candidates
    .map((candidate) => ({
      ...candidate,
      ingredientName: candidate.ingredientName.trim(),
      amountText: candidate.amountText?.trim() ?? null,
    }))
    .filter(
      (candidate) =>
        candidate.ingredientName.length > 0 &&
        candidate.amountText != null &&
        candidate.amountText.length > 0
    )
    .sort(
      (left, right) => right.ingredientName.length - left.ingredientName.length
    );

  return instructions.map((instruction) => {
    const matches: InstructionMatch[] = [];

    for (const candidate of usableCandidates) {
      const pattern = createIngredientPattern(candidate.ingredientName);
      if (!pattern) {
        continue;
      }

      for (const match of instruction.matchAll(pattern)) {
        const prefix = match[1] ?? "";
        const matchedText = match[2] ?? "";
        const rawIndex = match.index ?? 0;
        const start = rawIndex + prefix.length;
        const end = start + matchedText.length;

        if (overlaps(matches, start, end)) {
          continue;
        }

        matches.push({
          ingredientId: candidate.ingredientId,
          start,
          end,
          text: instruction.slice(start, end),
          amountText: candidate.amountText,
        });
      }
    }

    matches.sort((left, right) => left.start - right.start);

    if (matches.length === 0) {
      return {
        parts: [{ type: "text", value: instruction }],
        matchedIngredientIds: [],
      } satisfies AnnotatedInstructionStep;
    }

    const parts: AnnotatedInstructionPart[] = [];
    const matchedIngredientIds = new Set<string>();
    let cursor = 0;

    for (const match of matches) {
      if (match.start > cursor) {
        parts.push({
          type: "text",
          value: instruction.slice(cursor, match.start),
        });
      }

      parts.push({
        type: "match",
        ingredientId: match.ingredientId,
        text: match.text,
        amountText: match.amountText,
      });
      matchedIngredientIds.add(match.ingredientId);
      cursor = match.end;
    }

    if (cursor < instruction.length) {
      parts.push({
        type: "text",
        value: instruction.slice(cursor),
      });
    }

    return {
      parts,
      matchedIngredientIds: [...matchedIngredientIds],
    } satisfies AnnotatedInstructionStep;
  });
}