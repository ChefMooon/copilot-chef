import {
  chatRequestSchema,
  buildItemChoices,
  escapeRegex,
  findMatchingItems,
  formatMealType,
  nextNights,
  normalizeMealType,
  normalizeText,
  parseMealOps,
  parseSnapshot,
  resolveRelativeDate,
  serializeMealOps,
  snapshotFromList,
  toDateLabel,
  toWeekdayName,
  type GroceryListSnapshot,
  type MealForwardOp,
  type MealTypeValue,
} from "@copilot-chef/core";
import { NextResponse } from "next/server";

type ReasoningEffort = "low" | "medium" | "high" | "xhigh";

import {
  chef,
  historyService,
  preferenceService,
  groceryService,
  mealService,
} from "@/lib/chat-singletons";
import { MachineAuthError, requireCallerIdentity } from "@/lib/machine-auth";

const SESSION_TITLE_MAX_LENGTH = 72;
type ResponseMode = "auto" | "json" | "stream";

async function readTextFromStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    fullText += decoder.decode(value, { stream: true });
  }
  fullText += decoder.decode();

  return fullText;
}

function makeTextStreamResponse(input: {
  message: string;
  sessionId?: string;
  chatSessionId?: string;
  requestId: string;
}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(input.message));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "x-request-id": input.requestId,
      ...(input.sessionId ? { "x-session-id": input.sessionId } : {}),
      ...(input.chatSessionId
        ? { "x-chat-session-id": input.chatSessionId }
        : {}),
    },
  });
}

function summarizeSessionTitleFromMessage(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length <= SESSION_TITLE_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, SESSION_TITLE_MAX_LENGTH - 3).trimEnd()}...`;
}

type GroceryPageContext = Extract<
  NonNullable<ReturnType<typeof chatRequestSchema.parse>["pageContextData"]>,
  { page: "grocery-list" }
>;

type MealPlanPageContext = Extract<
  NonNullable<ReturnType<typeof chatRequestSchema.parse>["pageContextData"]>,
  { page: "meal-plan" }
>;

type ChatChoice = { id: string; label: string; prompt: string };

type HandledChatAction = {
  message: string;
  choices?: ChatChoice[];
  action: {
    domain: "grocery" | "meal";
    type: string;
    summary: string;
  };
};

async function recordSnapshotAction(
  chatSessionId: string | undefined,
  ownerId: string,
  input: {
    actionType: string;
    summary: string;
    before: GroceryListSnapshot;
    after: GroceryListSnapshot;
  }
) {
  if (!chatSessionId) {
    return;
  }

  await historyService.recordAction({
    ownerId,
    chatSessionId,
    domain: "grocery",
    actionType: input.actionType,
    summary: input.summary,
    forwardJson: JSON.stringify({ snapshot: input.after }),
    inverseJson: JSON.stringify({ snapshot: input.before }),
  });
}

async function applyActionSnapshot(payloadJson: string) {
  return groceryService.restoreGroceryListSnapshot(parseSnapshot(payloadJson));
}

async function applyMealOps(payloadJson: string) {
  const ops = parseMealOps(payloadJson);

  for (const op of ops) {
    if (op.op === "create") {
      const existing = await mealService.getMeal(op.meal.id);
      if (!existing) {
        await mealService.createMeal({
          id: op.meal.id,
          name: op.meal.name,
          date: op.meal.date,
          mealType: op.meal.mealType,
          notes: op.meal.notes,
          ingredients: op.meal.ingredients,
        });
      }
      continue;
    }

    if (op.op === "update") {
      await mealService.updateMeal(op.id, op.patch);
      continue;
    }

    if (op.op === "delete") {
      const existing = await mealService.getMeal(op.id);
      if (existing) {
        await mealService.deleteMeal(op.id);
      }
    }
  }
}

async function tryHandleMealCommand(
  message: string,
  pageContextData?: unknown,
  chatSessionId?: string,
  ownerId?: string
): Promise<HandledChatAction | null> {
  if (!pageContextData || typeof pageContextData !== "object") return null;
  const context = pageContextData as MealPlanPageContext;
  if (context.page !== "meal-plan") return null;

  const text = message.trim();

  if (/^(?:undo|undo last action)$/i.test(text)) {
    if (!chatSessionId) {
      return {
        message:
          "I could not find a chat session for undo yet. Try another command first.",
        action: {
          domain: "meal",
          type: "undo-unavailable",
          summary: "Undo unavailable without chat session",
        },
      };
    }

    const action = await historyService.getLatestUndoAction(
      ownerId ?? "web-default",
      chatSessionId,
      "meal"
    );
    if (!action) {
      return {
        message: "There is no meal action to undo.",
        action: {
          domain: "meal",
          type: "undo-empty",
          summary: "No meal action available to undo",
        },
      };
    }

    await applyMealOps(action.inverseJson);
    await historyService.markActionUndone(ownerId ?? "web-default", action.id);

    return {
      message: `Undid: ${action.summary}`,
      choices: [{ id: "redo", label: "Redo", prompt: "Redo" }],
      action: {
        domain: "meal",
        type: "undo",
        summary: `Undid action ${action.actionType}`,
      },
    };
  }

  if (/^(?:redo|redo last action)$/i.test(text)) {
    if (!chatSessionId) {
      return {
        message: "I could not find a chat session for redo yet.",
        action: {
          domain: "meal",
          type: "redo-unavailable",
          summary: "Redo unavailable without chat session",
        },
      };
    }

    const action = await historyService.getLatestRedoAction(
      ownerId ?? "web-default",
      chatSessionId,
      "meal"
    );
    if (!action) {
      return {
        message: "There is no meal action to redo.",
        action: {
          domain: "meal",
          type: "redo-empty",
          summary: "No meal action available to redo",
        },
      };
    }

    await applyMealOps(action.forwardJson);
    await historyService.markActionRedone(ownerId ?? "web-default", action.id);

    return {
      message: `Redid: ${action.summary}`,
      choices: [{ id: "undo", label: "Undo", prompt: "Undo" }],
      action: {
        domain: "meal",
        type: "redo",
        summary: `Redid action ${action.actionType}`,
      },
    };
  }

  const cloneTomorrowMatch = text.match(
    /^(?:create|add)\s+(?:a\s+new\s+)?(breakfast|morning\s+snack|lunch|afternoon\s+snack|dinner|snack)\b.+\b(?:for\s+)?tomorrow\b.*\bsame\s+as\s+today\b/i
  );
  if (cloneTomorrowMatch) {
    const mealType = normalizeMealType(cloneTomorrowMatch[1]);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (!mealType) {
      return {
        message:
          "I could not determine the meal type. Try: create a new breakfast entry for tomorrow that is the same as today.",
        action: {
          domain: "meal",
          type: "clarify-clone-type",
          summary: "Could not resolve meal type for clone command",
        },
      };
    }

    const todayMatches = context.meals.filter(
      (meal) =>
        normalizeMealType(meal.mealType) === mealType &&
        new Date(meal.date).toDateString() === today.toDateString()
    );

    if (todayMatches.length === 0) {
      return {
        message: `I couldn't find a ${formatMealType(mealType)} meal for today to copy.`,
        action: {
          domain: "meal",
          type: "clone-source-missing",
          summary: "No source meal found for clone command",
        },
      };
    }

    if (todayMatches.length > 1) {
      return {
        message: `I found multiple ${formatMealType(mealType)} meals today. Which one should I copy to tomorrow?`,
        choices: todayMatches.slice(0, 6).map((meal) => ({
          id: meal.id,
          label: meal.name,
          prompt: `Move ${meal.name} to tomorrow`,
        })),
        action: {
          domain: "meal",
          type: "clarify-clone-source",
          summary: "Multiple source meals found for clone command",
        },
      };
    }

    const source = await mealService.getMeal(todayMatches[0].id);
    if (!source) {
      return {
        message: "That source meal no longer exists. Please refresh and try again.",
        action: {
          domain: "meal",
          type: "clone-source-stale",
          summary: "Source meal missing during clone command",
        },
      };
    }

    const created = await mealService.createMeal({
      name: source.name,
      date: tomorrow.toISOString(),
      mealType: source.mealType,
      notes: source.notes,
      ingredients: source.ingredients,
    });

    if (chatSessionId) {
      await historyService.recordAction({
        ownerId: ownerId ?? "web-default",
        chatSessionId,
        domain: "meal",
        actionType: "clone-meal-to-tomorrow",
        summary: `Copied ${source.name} to tomorrow`,
        forwardJson: serializeMealOps([
          {
            op: "create",
            meal: {
              id: created.id,
              name: created.name,
              date: created.date,
              mealType: created.mealType,
              notes: created.notes,
              ingredients: created.ingredients,
            },
          },
        ]),
        inverseJson: serializeMealOps([{ op: "delete", id: created.id }]),
      });
    }

    return {
      message: `Copied ${created.name} to tomorrow (${toDateLabel(created.date)}).`,
      choices: [{ id: "undo", label: "Undo", prompt: "Undo" }],
      action: {
        domain: "meal",
        type: "clone-meal-to-tomorrow",
        summary: `Copied meal ${created.name} to tomorrow`,
      },
    };
  }

  const addMatch = text.match(
    /^(?:add)\s+(.+?)\s+for\s+(breakfast|morning\s+snack|lunch|afternoon\s+snack|dinner|snack)\s+(.+)$/i
  );
  if (addMatch) {
    const mealName = addMatch[1].trim();
    const mealType = normalizeMealType(addMatch[2]);
    const when = addMatch[3].trim();
    const resolvedDate = resolveRelativeDate(when);
    if (!mealType || !resolvedDate) {
      return {
        message:
          "I need a valid meal type and date. Try something like: Add Grilled Cheese for lunch today.",
        action: {
          domain: "meal",
          type: "clarify-add",
          summary: "Could not resolve add meal command",
        },
      };
    }

    const created = await mealService.createMeal({
      name: mealName,
      date: resolvedDate,
      mealType,
      notes: null,
      ingredients: [],
    });

    const forwardOps: MealForwardOp[] = [
      {
        op: "create",
        meal: {
          id: created.id,
          name: created.name,
          date: created.date,
          mealType: created.mealType,
          notes: created.notes,
          ingredients: created.ingredients,
        },
      },
    ];
    const inverseOps: MealForwardOp[] = [{ op: "delete", id: created.id }];

    if (chatSessionId) {
      await historyService.recordAction({
        ownerId: ownerId ?? "web-default",
        chatSessionId,
        domain: "meal",
        actionType: "add-meal",
        summary: `Added ${created.name} for ${formatMealType(created.mealType)} ${toDateLabel(created.date)}`,
        forwardJson: serializeMealOps(forwardOps),
        inverseJson: serializeMealOps(inverseOps),
      });
    }

    return {
      message: `Added ${created.name} for ${formatMealType(created.mealType)} on ${toDateLabel(created.date)}.`,
      choices: [{ id: "undo", label: "Undo", prompt: "Undo" }],
      action: {
        domain: "meal",
        type: "add-meal",
        summary: `Added meal ${created.name}`,
      },
    };
  }

  const moveMatch = text.match(
    /^(?:move)\s+(breakfast|morning\s+snack|lunch|afternoon\s+snack|dinner|snack)\s+from\s+(.+?)\s+to\s+(.+)$/i
  );
  if (moveMatch) {
    const mealType = normalizeMealType(moveMatch[1]);
    const fromText = moveMatch[2].trim();
    const toText = moveMatch[3].trim();
    const fromDate = resolveRelativeDate(fromText);
    const toDate = resolveRelativeDate(toText);
    if (!mealType || !fromDate || !toDate) {
      return {
        message:
          "I need valid source and destination dates. Example: Move lunch from Tuesday to Friday.",
        action: {
          domain: "meal",
          type: "clarify-move",
          summary: "Could not resolve move meal command",
        },
      };
    }

    const matches = context.meals.filter((meal) => {
      return (
        normalizeMealType(meal.mealType) === mealType &&
        new Date(meal.date).toDateString() === new Date(fromDate).toDateString()
      );
    });

    if (matches.length === 0) {
      return {
        message: `I couldn't find a ${formatMealType(mealType)} meal on ${new Date(fromDate).toLocaleDateString()} in the current view.`,
        action: {
          domain: "meal",
          type: "move-not-found",
          summary: "No meal found for move command",
        },
      };
    }

    if (matches.length > 1) {
      return {
        message: `I found multiple ${formatMealType(mealType)} meals on ${new Date(fromDate).toLocaleDateString()}. Which one should I move?`,
        choices: matches.slice(0, 6).map((meal) => ({
          id: meal.id,
          label: meal.name,
          prompt: `Move ${meal.name} to ${toText}`,
        })),
        action: {
          domain: "meal",
          type: "clarify-move-target",
          summary: "Multiple meals matched move command",
        },
      };
    }

    const selected = matches[0];
    const before = await mealService.getMeal(selected.id);
    if (!before) {
      return {
        message: "That meal no longer exists. Please refresh and try again.",
        action: {
          domain: "meal",
          type: "move-stale",
          summary: "Meal missing during move",
        },
      };
    }

    const updated = await mealService.updateMeal(selected.id, {
      date: toDate,
    });
    const forwardOps: MealForwardOp[] = [
      { op: "update", id: selected.id, patch: { date: updated.date } },
    ];
    const inverseOps: MealForwardOp[] = [
      { op: "update", id: selected.id, patch: { date: before.date } },
    ];

    if (chatSessionId) {
      await historyService.recordAction({
        ownerId: ownerId ?? "web-default",
        chatSessionId,
        domain: "meal",
        actionType: "move-meal",
        summary: `Moved ${updated.name} to ${toWeekdayName(updated.date)}`,
        forwardJson: serializeMealOps(forwardOps),
        inverseJson: serializeMealOps(inverseOps),
      });
    }

    return {
      message: `Moved ${updated.name} to ${toWeekdayName(updated.date)} (${toDateLabel(updated.date)}).`,
      choices: [{ id: "undo", label: "Undo", prompt: "Undo" }],
      action: {
        domain: "meal",
        type: "move-meal",
        summary: `Moved meal ${updated.name}`,
      },
    };
  }

  const moveByNameMatch = text.match(/^move\s+(.+?)\s+to\s+(.+)$/i);
  if (moveByNameMatch) {
    const mealName = moveByNameMatch[1].trim();
    const toText = moveByNameMatch[2].trim();
    const toDate = resolveRelativeDate(toText);
    if (!toDate) {
      return {
        message: `I couldn't parse "${toText}" as a date.`,
        action: {
          domain: "meal",
          type: "clarify-move-date",
          summary: "Could not parse move destination date",
        },
      };
    }

    const candidates = context.meals.filter((meal) =>
      normalizeText(meal.name).includes(normalizeText(mealName))
    );
    if (candidates.length === 0) {
      return {
        message: `I couldn't find a meal named "${mealName}" in the current view.`,
        action: {
          domain: "meal",
          type: "move-name-not-found",
          summary: "No meal matched move-by-name request",
        },
      };
    }
    if (candidates.length > 1) {
      return {
        message: `I found multiple meals matching "${mealName}". Which one should I move?`,
        choices: candidates.slice(0, 6).map((meal) => ({
          id: meal.id,
          label: `${meal.name} (${toWeekdayName(meal.date)})`,
          prompt: `Move ${meal.name} to ${toText}`,
        })),
        action: {
          domain: "meal",
          type: "clarify-move-name-target",
          summary: "Multiple meals matched move-by-name request",
        },
      };
    }

    const before = await mealService.getMeal(candidates[0].id);
    if (!before) {
      return {
        message: "That meal no longer exists. Please refresh and try again.",
        action: {
          domain: "meal",
          type: "move-stale",
          summary: "Meal missing during move-by-name",
        },
      };
    }

    const updated = await mealService.updateMeal(candidates[0].id, {
      date: toDate,
    });
    const forwardOps: MealForwardOp[] = [
      { op: "update", id: updated.id, patch: { date: updated.date } },
    ];
    const inverseOps: MealForwardOp[] = [
      { op: "update", id: updated.id, patch: { date: before.date } },
    ];

    if (chatSessionId) {
      await historyService.recordAction({
        ownerId: ownerId ?? "web-default",
        chatSessionId,
        domain: "meal",
        actionType: "move-meal",
        summary: `Moved ${updated.name} to ${toWeekdayName(updated.date)}`,
        forwardJson: serializeMealOps(forwardOps),
        inverseJson: serializeMealOps(inverseOps),
      });
    }

    return {
      message: `Moved ${updated.name} to ${toWeekdayName(updated.date)} (${toDateLabel(updated.date)}).`,
      choices: [{ id: "undo", label: "Undo", prompt: "Undo" }],
      action: {
        domain: "meal",
        type: "move-meal",
        summary: `Moved meal ${updated.name}`,
      },
    };
  }

  const replaceMatch = text.match(
    /^replace\s+(breakfast|morning\s+snack|lunch|afternoon\s+snack|dinner|snack)\s+(?:on|for)\s+(.+?)\s+with\s+(.+)$/i
  );
  if (replaceMatch) {
    const mealType = normalizeMealType(replaceMatch[1]);
    const dateText = replaceMatch[2].trim();
    const nextName = replaceMatch[3].trim();
    const date = resolveRelativeDate(dateText);
    if (!mealType || !date) {
      return {
        message:
          "I need a valid meal type/date to replace. Example: Replace dinner on Tuesday with Tacos.",
        action: {
          domain: "meal",
          type: "clarify-replace",
          summary: "Could not resolve replace meal command",
        },
      };
    }

    const matches = context.meals.filter(
      (meal) =>
        normalizeMealType(meal.mealType) === mealType &&
        new Date(meal.date).toDateString() === new Date(date).toDateString()
    );
    if (matches.length === 0) {
      return {
        message: `I couldn't find a ${formatMealType(mealType)} meal on ${new Date(date).toLocaleDateString()} in the current view.`,
        action: {
          domain: "meal",
          type: "replace-not-found",
          summary: "No meal found for replace command",
        },
      };
    }

    const before = await mealService.getMeal(matches[0].id);
    if (!before) {
      return {
        message: "That meal no longer exists. Please refresh and try again.",
        action: {
          domain: "meal",
          type: "replace-stale",
          summary: "Meal missing during replace",
        },
      };
    }

    const updated = await mealService.updateMeal(matches[0].id, {
      name: nextName,
    });
    const forwardOps: MealForwardOp[] = [
      { op: "update", id: updated.id, patch: { name: updated.name } },
    ];
    const inverseOps: MealForwardOp[] = [
      { op: "update", id: updated.id, patch: { name: before.name } },
    ];

    if (chatSessionId) {
      await historyService.recordAction({
        ownerId: ownerId ?? "web-default",
        chatSessionId,
        domain: "meal",
        actionType: "replace-meal",
        summary: `Replaced ${before.name} with ${updated.name}`,
        forwardJson: serializeMealOps(forwardOps),
        inverseJson: serializeMealOps(inverseOps),
      });
    }

    return {
      message: `Replaced ${before.name} with ${updated.name}.`,
      choices: [{ id: "undo", label: "Undo", prompt: "Undo" }],
      action: {
        domain: "meal",
        type: "replace-meal",
        summary: `Replaced meal with ${updated.name}`,
      },
    };
  }

  const removeMealMatch = text.match(
    /^(?:remove|delete)\s+(breakfast|morning\s+snack|lunch|afternoon\s+snack|dinner|snack)\s+(?:on|for)\s+(.+)$/i
  );
  if (removeMealMatch) {
    const mealType = normalizeMealType(removeMealMatch[1]);
    const dateText = removeMealMatch[2].trim();
    const date = resolveRelativeDate(dateText);
    if (!mealType || !date) {
      return {
        message:
          "I need a valid meal type/date to remove. Example: Remove lunch on Tuesday.",
        action: {
          domain: "meal",
          type: "clarify-remove",
          summary: "Could not resolve remove meal command",
        },
      };
    }

    const matches = context.meals.filter(
      (meal) =>
        normalizeMealType(meal.mealType) === mealType &&
        new Date(meal.date).toDateString() === new Date(date).toDateString()
    );
    if (matches.length === 0) {
      return {
        message: `I couldn't find a ${formatMealType(mealType)} meal on ${new Date(date).toLocaleDateString()} in the current view.`,
        action: {
          domain: "meal",
          type: "remove-not-found",
          summary: "No meal found for remove command",
        },
      };
    }

    const before = await mealService.getMeal(matches[0].id);
    if (!before) {
      return {
        message: "That meal no longer exists. Please refresh and try again.",
        action: {
          domain: "meal",
          type: "remove-stale",
          summary: "Meal missing during remove",
        },
      };
    }

    await mealService.deleteMeal(before.id);
    const forwardOps: MealForwardOp[] = [{ op: "delete", id: before.id }];
    const inverseOps: MealForwardOp[] = [
      {
        op: "create",
        meal: {
          id: before.id,
          name: before.name,
          date: before.date,
          mealType: before.mealType,
          notes: before.notes,
          ingredients: before.ingredients,
        },
      },
    ];

    if (chatSessionId) {
      await historyService.recordAction({
        ownerId: ownerId ?? "web-default",
        chatSessionId,
        domain: "meal",
        actionType: "remove-meal",
        summary: `Removed ${before.name}`,
        forwardJson: JSON.stringify({ ops: forwardOps }),
        inverseJson: JSON.stringify({ ops: inverseOps }),
      });
    }

    return {
      message: `Removed ${before.name} (${formatMealType(before.mealType)} on ${toDateLabel(before.date)}).`,
      choices: [{ id: "undo", label: "Undo", prompt: "Undo" }],
      action: {
        domain: "meal",
        type: "remove-meal",
        summary: `Removed meal ${before.name}`,
      },
    };
  }

  const suggestMatch = text.match(
    /^(?:suggest|plan)\s+(\d+)\s+(?:meals|dinners)(?:\s+for\s+next\s+\d+\s+nights?)?/i
  );
  if (suggestMatch && chatSessionId) {
    const count = Math.max(
      1,
      Math.min(7, Number.parseInt(suggestMatch[1], 10))
    );
    const pool = [
      "Lemon Herb Chicken Bowls",
      "Creamy Tomato Pasta",
      "Miso Glazed Salmon",
      "Black Bean Tacos",
      "Sheet Pan Sausage and Veg",
      "Coconut Curry Chickpeas",
      "Turkey Lettuce Wraps",
      "Garlic Butter Shrimp Rice",
    ];
    const picks = Array.from({ length: count }).map(
      (_, index) => pool[index % pool.length]
    );

    await Promise.all(
      picks.map((name, index) =>
        historyService.addPendingSuggestion({
          ownerId: ownerId ?? "web-default",
          chatSessionId,
          domain: "meal",
          title: name,
          payloadJson: JSON.stringify({
            name,
            mealType: "DINNER",
            rank: index,
          }),
        })
      )
    );

    return {
      message: `Planned ${count} dinner ideas. You can now say: use the ${count} meals we just planned for the next ${count} nights dinner.`,
      choices: [
        {
          id: "use-pending",
          label: `Use ${count} meals for next ${count} nights`,
          prompt: `Use the ${count} meals we just planned for the next ${count} nights dinner`,
        },
      ],
      action: {
        domain: "meal",
        type: "pending-suggestions-created",
        summary: `Created ${count} pending meal suggestions`,
      },
    };
  }

  const usePendingMatch = text.match(
    /^use\s+the\s+(\d+)\s+meals\s+we\s+just\s+planned\s+for\s+the\s+next\s+(\d+)\s+nights\s+dinner$/i
  );
  if (usePendingMatch && chatSessionId) {
    const requested = Number.parseInt(usePendingMatch[1], 10);
    const nights = Number.parseInt(usePendingMatch[2], 10);
    const count = Math.max(1, Math.min(requested, nights));
    const suggestions = (
      await historyService.listPendingSuggestions(
        ownerId ?? "web-default",
        chatSessionId
      )
    )
      .filter((entry) => entry.domain === "meal")
      .slice(0, count)
      .reverse();

    if (suggestions.length < count) {
      return {
        message: `I only found ${suggestions.length} pending meal suggestions. Ask me to suggest ${count} meals first.`,
        action: {
          domain: "meal",
          type: "pending-suggestions-missing",
          summary: "Not enough pending suggestions",
        },
      };
    }

    const dates = nextNights(count);
    const createdMeals = [] as Awaited<
      ReturnType<typeof mealService.createMeal>
    >[];
    for (let i = 0; i < count; i += 1) {
      const suggestion = suggestions[i];
      const payload = JSON.parse(suggestion.payloadJson) as {
        name: string;
        mealType?: MealTypeValue;
      };
      const created = await mealService.createMeal({
        name: payload.name,
        date: dates[i],
        mealType: payload.mealType ?? "DINNER",
        notes: null,
        ingredients: [],
      });
      createdMeals.push(created);
    }

    const forwardOps: MealForwardOp[] = createdMeals.map((meal) => ({
      op: "create",
      meal: {
        id: meal.id,
        name: meal.name,
        date: meal.date,
        mealType: meal.mealType,
        notes: meal.notes,
        ingredients: meal.ingredients,
      },
    }));
    const inverseOps: MealForwardOp[] = createdMeals.map((meal) => ({
      op: "delete",
      id: meal.id,
    }));

    await historyService.recordAction({
      ownerId: ownerId ?? "web-default",
      chatSessionId,
      domain: "meal",
      actionType: "apply-pending-suggestions",
      summary: `Added ${createdMeals.length} dinners from pending suggestions`,
      forwardJson: serializeMealOps(forwardOps),
      inverseJson: serializeMealOps(inverseOps),
    });

    return {
      message: `Added ${createdMeals.length} dinners for the next ${createdMeals.length} nights.`,
      choices: [{ id: "undo", label: "Undo", prompt: "Undo" }],
      action: {
        domain: "meal",
        type: "apply-pending-suggestions",
        summary: `Created ${createdMeals.length} meal entries from pending suggestions`,
      },
    };
  }

  return null;
}

async function tryHandleGroceryCommand(
  message: string,
  pageContextData?: unknown,
  chatSessionId?: string,
  ownerId?: string
): Promise<HandledChatAction | null> {
  if (!pageContextData || typeof pageContextData !== "object") return null;
  const context = pageContextData as GroceryPageContext;
  if (context.page !== "grocery-list") return null;

  const text = message.trim();
  const activeList = context.activeList;

  if (/^(?:undo|undo last action)$/i.test(text)) {
    if (!chatSessionId) {
      return {
        message:
          "I could not find a chat session for undo yet. Try another command first.",
        action: {
          domain: "grocery",
          type: "undo-unavailable",
          summary: "Undo unavailable without chat session",
        },
      };
    }

    const action = await historyService.getLatestUndoAction(
      ownerId ?? "web-default",
      chatSessionId,
      "grocery"
    );
    if (!action) {
      return {
        message: "There is no grocery action to undo.",
        action: {
          domain: "grocery",
          type: "undo-empty",
          summary: "No grocery action available to undo",
        },
      };
    }

    await applyActionSnapshot(action.inverseJson);
    await historyService.markActionUndone(ownerId ?? "web-default", action.id);

    return {
      message: `Undid: ${action.summary}`,
      choices: [{ id: "redo", label: "Redo", prompt: "Redo" }],
      action: {
        domain: "grocery",
        type: "undo",
        summary: `Undid action ${action.actionType}`,
      },
    };
  }

  if (/^(?:redo|redo last action)$/i.test(text)) {
    if (!chatSessionId) {
      return {
        message: "I could not find a chat session for redo yet.",
        action: {
          domain: "grocery",
          type: "redo-unavailable",
          summary: "Redo unavailable without chat session",
        },
      };
    }

    const action = await historyService.getLatestRedoAction(
      ownerId ?? "web-default",
      chatSessionId,
      "grocery"
    );
    if (!action) {
      return {
        message: "There is no grocery action to redo.",
        action: {
          domain: "grocery",
          type: "redo-empty",
          summary: "No grocery action available to redo",
        },
      };
    }

    await applyActionSnapshot(action.forwardJson);
    await historyService.markActionRedone(ownerId ?? "web-default", action.id);

    return {
      message: `Redid: ${action.summary}`,
      choices: [{ id: "undo", label: "Undo", prompt: "Undo" }],
      action: {
        domain: "grocery",
        type: "redo",
        summary: `Redid action ${action.actionType}`,
      },
    };
  }

  const requireActiveList = (): HandledChatAction => ({
    message:
      "I need an active grocery list first. Choose one of your lists and I can apply that change.",
    choices: context.allLists.slice(0, 6).map((list) => ({
      id: list.id,
      label: `Use ${list.name}`,
      prompt: `Set active grocery list to ${list.name}`,
    })),
    action: {
      domain: "grocery",
      type: "clarify-list-target",
      summary: "Needs an active grocery list target",
    },
  });

  const addMatch = text.match(
    /^(?:add|put)\s+(.+?)(?:\s+(?:to|on)\s+(?:this\s+)?(?:grocery\s+)?list)?$/i
  );
  if (addMatch) {
    if (!activeList) return requireActiveList();
    const beforeList = await groceryService.getGroceryList(activeList.id);
    if (!beforeList) {
      throw new Error("Grocery list not found");
    }
    const itemName = addMatch[1].trim();
    const updatedList = await groceryService.createGroceryItem(activeList.id, {
      name: itemName,
    });
    await recordSnapshotAction(chatSessionId, ownerId ?? "web-default", {
      actionType: "add-item",
      summary: `Added ${itemName} to ${updatedList.name}`,
      before: snapshotFromList(beforeList),
      after: snapshotFromList(updatedList),
    });
    return {
      message: `Added ${itemName} to ${updatedList.name}.`,
      choices: [
        {
          id: "add-another",
          label: "Add another item",
          prompt: "Add garlic to this list",
        },
        {
          id: "mark-item",
          label: `Mark ${itemName} complete`,
          prompt: `Mark ${itemName} complete`,
        },
      ],
      action: {
        domain: "grocery",
        type: "add-item",
        summary: `Added ${itemName} to grocery list`,
      },
    };
  }

  const completeMatch = text.match(
    /^(?:mark|check(?:\s+off)?)\s+(.+?)\s*(?:as\s+)?(?:complete|done|checked)?$/i
  );
  if (completeMatch) {
    if (!activeList) return requireActiveList();
    const beforeList = await groceryService.getGroceryList(activeList.id);
    if (!beforeList) {
      throw new Error("Grocery list not found");
    }
    const target = completeMatch[1].trim();
    const matches = findMatchingItems(activeList.items, target);
    if (matches.length === 0) {
      return {
        message: `I couldn't find "${target}" in ${activeList.name}. Pick one of these items or edit the item name.`,
        choices: buildItemChoices(
          activeList.items,
          (name) => `Mark ${name} complete`
        ),
        action: {
          domain: "grocery",
          type: "clarify-item-target",
          summary: "Could not resolve grocery item for completion",
        },
      };
    }
    if (matches.length > 1) {
      return {
        message: `I found multiple matches for "${target}". Which one should I mark complete?`,
        choices: buildItemChoices(matches, (name) => `Mark ${name} complete`),
        action: {
          domain: "grocery",
          type: "clarify-item-target",
          summary: "Multiple grocery items matched completion request",
        },
      };
    }

    const item = matches[0];
    const updatedList = await groceryService.updateGroceryItem(
      activeList.id,
      item.id,
      { checked: true }
    );
    await recordSnapshotAction(chatSessionId, ownerId ?? "web-default", {
      actionType: "check-item",
      summary: `Checked ${item.name}`,
      before: snapshotFromList(beforeList),
      after: snapshotFromList(updatedList),
    });
    return {
      message: `Checked off ${item.name}.`,
      choices: [
        { id: "undo-check", label: `Undo`, prompt: `Uncheck ${item.name}` },
      ],
      action: {
        domain: "grocery",
        type: "check-item",
        summary: `Marked ${item.name} complete`,
      },
    };
  }

  const uncheckMatch = text.match(
    /^(?:uncheck|mark)\s+(.+?)\s*(?:as\s+)?(?:incomplete|not\s+done|unchecked)?$/i
  );
  if (uncheckMatch) {
    if (!activeList) return requireActiveList();
    const beforeList = await groceryService.getGroceryList(activeList.id);
    if (!beforeList) {
      throw new Error("Grocery list not found");
    }
    const target = uncheckMatch[1].replace(/\s+as\s+.*$/i, "").trim();
    const matches = findMatchingItems(activeList.items, target);
    if (matches.length === 0) return null;
    if (matches.length > 1) {
      return {
        message: `I found multiple matches for "${target}". Which one should I uncheck?`,
        choices: buildItemChoices(matches, (name) => `Uncheck ${name}`),
        action: {
          domain: "grocery",
          type: "clarify-item-target",
          summary: "Multiple grocery items matched uncheck request",
        },
      };
    }

    const item = matches[0];
    const updatedList = await groceryService.updateGroceryItem(
      activeList.id,
      item.id,
      { checked: false }
    );
    await recordSnapshotAction(chatSessionId, ownerId ?? "web-default", {
      actionType: "uncheck-item",
      summary: `Unchecked ${item.name}`,
      before: snapshotFromList(beforeList),
      after: snapshotFromList(updatedList),
    });
    return {
      message: `Unchecked ${item.name}.`,
      action: {
        domain: "grocery",
        type: "uncheck-item",
        summary: `Marked ${item.name} incomplete`,
      },
    };
  }

  const removeMatch = text.match(
    /^(?:remove|delete|take)\s+(.+?)(?:\s+(?:from|off)\s+(?:this\s+)?(?:grocery\s+)?list)?$/i
  );
  if (removeMatch) {
    if (!activeList) return requireActiveList();
    const beforeList = await groceryService.getGroceryList(activeList.id);
    if (!beforeList) {
      throw new Error("Grocery list not found");
    }
    const target = removeMatch[1].trim();
    const normalized = target.replace(/\s+off\s+the\s+list$/i, "").trim();
    const matches = findMatchingItems(activeList.items, normalized);
    if (matches.length === 0) {
      return {
        message: `I couldn't find "${normalized}" in ${activeList.name}.`,
        choices: buildItemChoices(activeList.items, (name) => `Remove ${name}`),
        action: {
          domain: "grocery",
          type: "clarify-item-target",
          summary: "Could not resolve grocery item for deletion",
        },
      };
    }
    if (matches.length > 1) {
      return {
        message: `I found multiple matches for "${normalized}". Which one should I remove?`,
        choices: buildItemChoices(matches, (name) => `Remove ${name}`),
        action: {
          domain: "grocery",
          type: "clarify-item-target",
          summary: "Multiple grocery items matched delete request",
        },
      };
    }

    const item = matches[0];
    const updatedList = await groceryService.deleteGroceryItem(
      activeList.id,
      item.id
    );
    await recordSnapshotAction(chatSessionId, ownerId ?? "web-default", {
      actionType: "remove-item",
      summary: `Removed ${item.name} from ${updatedList.name}`,
      before: snapshotFromList(beforeList),
      after: snapshotFromList(updatedList),
    });
    return {
      message: `Removed ${item.name} from ${activeList.name}.`,
      action: {
        domain: "grocery",
        type: "remove-item",
        summary: `Removed ${item.name} from grocery list`,
      },
    };
  }

  const renameMatch = text.match(
    /^(?:rename|call)\s+(?:this\s+)?list\s+(?:to|as)\s+(.+)$/i
  );
  if (renameMatch) {
    if (!activeList) return requireActiveList();
    const beforeList = await groceryService.getGroceryList(activeList.id);
    if (!beforeList) {
      throw new Error("Grocery list not found");
    }
    const nextName = renameMatch[1].trim();
    const updatedList = await groceryService.updateGroceryList(activeList.id, {
      name: nextName,
    });
    await recordSnapshotAction(chatSessionId, ownerId ?? "web-default", {
      actionType: "rename-list",
      summary: `Renamed grocery list to ${nextName}`,
      before: snapshotFromList(beforeList),
      after: snapshotFromList(updatedList),
    });
    return {
      message: `Renamed the list to ${nextName}.`,
      action: {
        domain: "grocery",
        type: "rename-list",
        summary: `Renamed grocery list to ${nextName}`,
      },
    };
  }

  if (
    /^(?:favorite|favourite|star)\s+(?:this\s+)?(?:grocery\s+)?list$/i.test(
      text
    )
  ) {
    if (!activeList) return requireActiveList();
    const beforeList = await groceryService.getGroceryList(activeList.id);
    if (!beforeList) {
      throw new Error("Grocery list not found");
    }
    const updatedList = await groceryService.updateGroceryList(activeList.id, {
      favourite: true,
    });
    await recordSnapshotAction(chatSessionId, ownerId ?? "web-default", {
      actionType: "favorite-list",
      summary: `Favorited ${updatedList.name}`,
      before: snapshotFromList(beforeList),
      after: snapshotFromList(updatedList),
    });
    return {
      message: `Marked ${activeList.name} as a favorite list.`,
      action: {
        domain: "grocery",
        type: "favorite-list",
        summary: `Favorited grocery list ${activeList.name}`,
      },
    };
  }

  if (
    /^(?:unfavorite|unfavourite|unstar)\s+(?:this\s+)?(?:grocery\s+)?list$/i.test(
      text
    )
  ) {
    if (!activeList) return requireActiveList();
    const beforeList = await groceryService.getGroceryList(activeList.id);
    if (!beforeList) {
      throw new Error("Grocery list not found");
    }
    const updatedList = await groceryService.updateGroceryList(activeList.id, {
      favourite: false,
    });
    await recordSnapshotAction(chatSessionId, ownerId ?? "web-default", {
      actionType: "unfavorite-list",
      summary: `Unfavorited ${updatedList.name}`,
      before: snapshotFromList(beforeList),
      after: snapshotFromList(updatedList),
    });
    return {
      message: `Removed favorite status from ${activeList.name}.`,
      action: {
        domain: "grocery",
        type: "unfavorite-list",
        summary: `Unfavorited grocery list ${activeList.name}`,
      },
    };
  }

  const dateMatch = text.match(
    /^(?:move|set)\s+(?:this\s+)?list\s+(?:to|for)\s+(.+)$/i
  );
  if (dateMatch) {
    if (!activeList) return requireActiveList();
    const beforeList = await groceryService.getGroceryList(activeList.id);
    if (!beforeList) {
      throw new Error("Grocery list not found");
    }
    const dateText = dateMatch[1].trim();
    const resolvedDate = resolveRelativeDate(dateText);
    if (!resolvedDate) {
      return {
        message: `I couldn't parse "${dateText}" as a date. Try a specific date, weekday, today, or tomorrow.`,
        action: {
          domain: "grocery",
          type: "clarify-date",
          summary: "Could not parse grocery list date",
        },
      };
    }

    const updatedList = await groceryService.updateGroceryList(activeList.id, {
      date: resolvedDate,
    });
    await recordSnapshotAction(chatSessionId, ownerId ?? "web-default", {
      actionType: "set-list-date",
      summary: `Set ${updatedList.name} date to ${new Date(resolvedDate).toLocaleDateString()}`,
      before: snapshotFromList(beforeList),
      after: snapshotFromList(updatedList),
    });
    return {
      message: `Set ${activeList.name} for ${new Date(resolvedDate).toLocaleDateString()}.`,
      action: {
        domain: "grocery",
        type: "set-list-date",
        summary: `Updated grocery list date to ${resolvedDate}`,
      },
    };
  }

  const qtyMatch = text.match(/^(?:change|set)\s+(.+?)\s+qty\s+to\s+(.+)$/i);
  if (qtyMatch) {
    if (!activeList) return requireActiveList();
    const beforeList = await groceryService.getGroceryList(activeList.id);
    if (!beforeList) {
      throw new Error("Grocery list not found");
    }
    const target = qtyMatch[1].trim();
    const qty = qtyMatch[2].trim();
    const matches = findMatchingItems(activeList.items, target);
    if (matches.length !== 1) {
      return {
        message:
          matches.length === 0
            ? `I couldn't find "${target}" in ${activeList.name}.`
            : `I found multiple matches for "${target}". Which one should I update?`,
        choices: buildItemChoices(
          matches.length > 0 ? matches : activeList.items,
          (name) => `Set ${name} qty to ${qty}`
        ),
        action: {
          domain: "grocery",
          type: "clarify-item-target",
          summary: "Could not resolve grocery item for qty update",
        },
      };
    }

    const item = matches[0];
    const updatedList = await groceryService.updateGroceryItem(
      activeList.id,
      item.id,
      { qty }
    );
    await recordSnapshotAction(chatSessionId, ownerId ?? "web-default", {
      actionType: "update-item-qty",
      summary: `Set ${item.name} qty to ${qty}`,
      before: snapshotFromList(beforeList),
      after: snapshotFromList(updatedList),
    });
    return {
      message: `Updated ${item.name} qty to ${qty}.`,
      choices: [{ id: "undo", label: "Undo", prompt: "Undo" }],
      action: {
        domain: "grocery",
        type: "update-item-qty",
        summary: `Updated qty for ${item.name}`,
      },
    };
  }

  const unitMatch = text.match(/^(?:change|set)\s+(.+?)\s+unit\s+to\s+(.+)$/i);
  if (unitMatch) {
    if (!activeList) return requireActiveList();
    const beforeList = await groceryService.getGroceryList(activeList.id);
    if (!beforeList) {
      throw new Error("Grocery list not found");
    }
    const target = unitMatch[1].trim();
    const unit = unitMatch[2].trim();
    const matches = findMatchingItems(activeList.items, target);
    if (matches.length !== 1) {
      return {
        message:
          matches.length === 0
            ? `I couldn't find "${target}" in ${activeList.name}.`
            : `I found multiple matches for "${target}". Which one should I update?`,
        choices: buildItemChoices(
          matches.length > 0 ? matches : activeList.items,
          (name) => `Set ${name} unit to ${unit}`
        ),
        action: {
          domain: "grocery",
          type: "clarify-item-target",
          summary: "Could not resolve grocery item for unit update",
        },
      };
    }

    const item = matches[0];
    const updatedList = await groceryService.updateGroceryItem(
      activeList.id,
      item.id,
      { unit }
    );
    await recordSnapshotAction(chatSessionId, ownerId ?? "web-default", {
      actionType: "update-item-unit",
      summary: `Set ${item.name} unit to ${unit}`,
      before: snapshotFromList(beforeList),
      after: snapshotFromList(updatedList),
    });
    return {
      message: `Updated ${item.name} unit to ${unit}.`,
      choices: [{ id: "undo", label: "Undo", prompt: "Undo" }],
      action: {
        domain: "grocery",
        type: "update-item-unit",
        summary: `Updated unit for ${item.name}`,
      },
    };
  }

  const categoryMatch = text.match(
    /^(?:move|set)\s+(.+?)\s+(?:to|in)\s+([\w\s&-]+)\s+category$/i
  );
  if (categoryMatch) {
    if (!activeList) return requireActiveList();
    const beforeList = await groceryService.getGroceryList(activeList.id);
    if (!beforeList) {
      throw new Error("Grocery list not found");
    }
    const target = categoryMatch[1].trim();
    const category = categoryMatch[2].trim();
    const matches = findMatchingItems(activeList.items, target);
    if (matches.length !== 1) {
      return {
        message:
          matches.length === 0
            ? `I couldn't find "${target}" in ${activeList.name}.`
            : `I found multiple matches for "${target}". Which one should I move to ${category}?`,
        choices: buildItemChoices(
          matches.length > 0 ? matches : activeList.items,
          (name) => `Move ${name} to ${category} category`
        ),
        action: {
          domain: "grocery",
          type: "clarify-item-target",
          summary: "Could not resolve grocery item for category update",
        },
      };
    }

    const item = matches[0];
    const updatedList = await groceryService.updateGroceryItem(
      activeList.id,
      item.id,
      { category }
    );
    await recordSnapshotAction(chatSessionId, ownerId ?? "web-default", {
      actionType: "update-item-category",
      summary: `Moved ${item.name} to ${category}`,
      before: snapshotFromList(beforeList),
      after: snapshotFromList(updatedList),
    });
    return {
      message: `Moved ${item.name} to ${category}.`,
      choices: [{ id: "undo", label: "Undo", prompt: "Undo" }],
      action: {
        domain: "grocery",
        type: "update-item-category",
        summary: `Updated category for ${item.name}`,
      },
    };
  }

  const renameItemMatch = text.match(/^rename\s+item\s+(.+?)\s+to\s+(.+)$/i);
  if (renameItemMatch) {
    if (!activeList) return requireActiveList();
    const beforeList = await groceryService.getGroceryList(activeList.id);
    if (!beforeList) {
      throw new Error("Grocery list not found");
    }
    const target = renameItemMatch[1].trim();
    const nextName = renameItemMatch[2].trim();
    const matches = findMatchingItems(activeList.items, target);
    if (matches.length !== 1) {
      return {
        message:
          matches.length === 0
            ? `I couldn't find "${target}" in ${activeList.name}.`
            : `I found multiple matches for "${target}". Which one should I rename?`,
        choices: buildItemChoices(
          matches.length > 0 ? matches : activeList.items,
          (name) => `Rename item ${name} to ${nextName}`
        ),
        action: {
          domain: "grocery",
          type: "clarify-item-target",
          summary: "Could not resolve grocery item for rename",
        },
      };
    }

    const item = matches[0];
    const updatedList = await groceryService.updateGroceryItem(
      activeList.id,
      item.id,
      { name: nextName }
    );
    await recordSnapshotAction(chatSessionId, ownerId ?? "web-default", {
      actionType: "rename-item",
      summary: `Renamed ${item.name} to ${nextName}`,
      before: snapshotFromList(beforeList),
      after: snapshotFromList(updatedList),
    });
    return {
      message: `Renamed ${item.name} to ${nextName}.`,
      choices: [{ id: "undo", label: "Undo", prompt: "Undo" }],
      action: {
        domain: "grocery",
        type: "rename-item",
        summary: `Renamed grocery item to ${nextName}`,
      },
    };
  }

  const moveTopMatch = text.match(/^move\s+(.+?)\s+to\s+(?:the\s+)?top$/i);
  if (moveTopMatch) {
    if (!activeList) return requireActiveList();
    const beforeList = await groceryService.getGroceryList(activeList.id);
    if (!beforeList) {
      throw new Error("Grocery list not found");
    }
    const target = moveTopMatch[1].trim();
    const matches = findMatchingItems(activeList.items, target);
    if (matches.length !== 1) {
      return {
        message:
          matches.length === 0
            ? `I couldn't find "${target}" in ${activeList.name}.`
            : `I found multiple matches for "${target}". Which one should I move to the top?`,
        choices: buildItemChoices(
          matches.length > 0 ? matches : activeList.items,
          (name) => `Move ${name} to the top`
        ),
        action: {
          domain: "grocery",
          type: "clarify-item-target",
          summary: "Could not resolve grocery item for manual reorder",
        },
      };
    }

    const targetId = matches[0].id;
    const ordered = [
      targetId,
      ...activeList.items
        .filter((item) => item.id !== targetId)
        .map((item) => item.id),
    ];
    const updatedList = await groceryService.reorderGroceryItems(
      activeList.id,
      ordered
    );
    await recordSnapshotAction(chatSessionId, ownerId ?? "web-default", {
      actionType: "manual-reorder",
      summary: `Moved ${matches[0].name} to top`,
      before: snapshotFromList(beforeList),
      after: snapshotFromList(updatedList),
    });

    return {
      message: `Moved ${matches[0].name} to the top of ${activeList.name}.`,
      choices: [{ id: "undo", label: "Undo", prompt: "Undo" }],
      action: {
        domain: "grocery",
        type: "manual-reorder",
        summary: `Moved ${matches[0].name} to top`,
      },
    };
  }

  const firstSecondMatch = text.match(
    /^put\s+(.+?)\s+first\s+and\s+(.+?)\s+second$/i
  );
  if (firstSecondMatch) {
    if (!activeList) return requireActiveList();
    const beforeList = await groceryService.getGroceryList(activeList.id);
    if (!beforeList) {
      throw new Error("Grocery list not found");
    }
    const firstTarget = firstSecondMatch[1].trim();
    const secondTarget = firstSecondMatch[2].trim();
    const firstMatches = findMatchingItems(activeList.items, firstTarget);
    const secondMatches = findMatchingItems(activeList.items, secondTarget);

    if (firstMatches.length !== 1 || secondMatches.length !== 1) {
      return {
        message: "I need a unique match for both items to reorder manually.",
        action: {
          domain: "grocery",
          type: "clarify-manual-reorder",
          summary: "Could not resolve items for manual reorder",
        },
      };
    }

    const firstId = firstMatches[0].id;
    const secondId = secondMatches[0].id;
    const ordered = [
      firstId,
      secondId,
      ...activeList.items
        .filter((item) => item.id !== firstId && item.id !== secondId)
        .map((item) => item.id),
    ];
    const updatedList = await groceryService.reorderGroceryItems(
      activeList.id,
      ordered
    );
    await recordSnapshotAction(chatSessionId, ownerId ?? "web-default", {
      actionType: "manual-reorder",
      summary: `Put ${firstMatches[0].name} first and ${secondMatches[0].name} second`,
      before: snapshotFromList(beforeList),
      after: snapshotFromList(updatedList),
    });

    return {
      message: `Put ${firstMatches[0].name} first and ${secondMatches[0].name} second in ${activeList.name}.`,
      choices: [{ id: "undo", label: "Undo", prompt: "Undo" }],
      action: {
        domain: "grocery",
        type: "manual-reorder",
        summary: "Applied manual reorder",
      },
    };
  }

  if (/^(?:reorder|group).*(?:by\s+category)/i.test(text)) {
    if (!activeList) return requireActiveList();
    const beforeList = await groceryService.getGroceryList(activeList.id);
    if (!beforeList) {
      throw new Error("Grocery list not found");
    }
    const ordered = activeList.items
      .slice()
      .sort((left, right) => {
        const catCompare = left.category.localeCompare(right.category);
        if (catCompare !== 0) return catCompare;
        return left.name.localeCompare(right.name);
      })
      .map((item) => item.id);
    const updatedList = await groceryService.reorderGroceryItems(
      activeList.id,
      ordered
    );
    await recordSnapshotAction(chatSessionId, ownerId ?? "web-default", {
      actionType: "reorder-by-category",
      summary: `Reordered ${updatedList.name} by category`,
      before: snapshotFromList(beforeList),
      after: snapshotFromList(updatedList),
    });
    return {
      message: `Reordered ${activeList.name} by category.`,
      action: {
        domain: "grocery",
        type: "reorder-by-category",
        summary: `Reordered grocery list ${activeList.name} by category`,
      },
    };
  }

  const bulkMatch = text.match(
    /^(?:mark|check|uncheck)\s+all\s+(.+?)\s+(?:items\s+)?(complete|done|checked|unchecked|incomplete)$/i
  );
  if (bulkMatch) {
    if (!activeList) return requireActiveList();
    const beforeList = await groceryService.getGroceryList(activeList.id);
    if (!beforeList) {
      throw new Error("Grocery list not found");
    }
    const actionWord = normalizeText(text).startsWith("uncheck")
      ? "unchecked"
      : normalizeText(bulkMatch[2]);
    const checked = !["unchecked", "incomplete"].includes(actionWord);
    const categoryLabel = bulkMatch[1].trim();
    const regex = new RegExp(`^${escapeRegex(categoryLabel)}$`, "i");
    const matches = activeList.items.filter((item) =>
      regex.test(item.category)
    );
    if (matches.length === 0) {
      return {
        message: `I found no ${categoryLabel} items in ${activeList.name}, so I didn't change anything.`,
        action: {
          domain: "grocery",
          type: "bulk-check-noop",
          summary: `No grocery items matched category ${categoryLabel}`,
        },
      };
    }

    await Promise.all(
      matches.map((item) =>
        groceryService.updateGroceryItem(activeList.id, item.id, { checked })
      )
    );
    const updatedList = await groceryService.getGroceryList(activeList.id);
    if (!updatedList) {
      throw new Error("Grocery list not found");
    }
    await recordSnapshotAction(chatSessionId, ownerId ?? "web-default", {
      actionType: checked ? "bulk-check" : "bulk-uncheck",
      summary: `${checked ? "Checked" : "Unchecked"} ${matches.length} ${categoryLabel} items`,
      before: snapshotFromList(beforeList),
      after: snapshotFromList(updatedList),
    });
    return {
      message: `${checked ? "Checked" : "Unchecked"} ${matches.length} ${categoryLabel} item${
        matches.length === 1 ? "" : "s"
      } in ${activeList.name}.`,
      action: {
        domain: "grocery",
        type: checked ? "bulk-check" : "bulk-uncheck",
        summary: `${checked ? "Checked" : "Unchecked"} ${matches.length} grocery items`,
      },
    };
  }

  return null;
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const identity = requireCallerIdentity(request);
    const ownerId = identity.callerId;

    const body = await request.json();
    const parsed = chatRequestSchema.parse(body);
    const responseMode = parsed.responseMode as ResponseMode;

    console.info("[chat-route] request", {
      requestId,
      callerId: ownerId,
      responseMode,
      sessionId: parsed.sessionId,
      chatSessionId: parsed.chatSessionId,
    });

    // Check history persistence preference before calling Copilot.
    const prefs = await preferenceService.getPreferences();
    const shouldPersist = prefs?.saveChatHistory ?? true;

    let activeChatSessionId = parsed.chatSessionId;
    if (activeChatSessionId) {
      const ownedSession = await historyService.getSession(
        ownerId,
        activeChatSessionId
      );
      if (!ownedSession) {
        return NextResponse.json(
          { error: "Session not found", requestId },
          { status: 404 }
        );
      }
    }

    // Keep a session handle for ownership-bound follow-up APIs even when
    // message persistence is disabled.
    if (!activeChatSessionId) {
      const newSession = await historyService.createSession(
        ownerId,
        summarizeSessionTitleFromMessage(parsed.message) ?? undefined
      );
      activeChatSessionId = newSession.id;
    }

    if (shouldPersist && activeChatSessionId) {
      await historyService.addMessage(
        ownerId,
        activeChatSessionId,
        "user",
        parsed.message
      );
    }

    const fallbackFirst = process.env["COPILOT_CHAT_ROUTE_FALLBACK_FIRST"] === "1";
    const safeMealFallback = /\b(?:for\s+)?tomorrow\b.*\bsame\s+as\s+today\b/i.test(
      parsed.message
    );

    if (fallbackFirst || safeMealFallback) {
      const mealHandled = await tryHandleMealCommand(
        parsed.message,
        parsed.pageContextData,
        activeChatSessionId,
        ownerId
      );
      if (mealHandled) {
        if (shouldPersist && activeChatSessionId) {
          await historyService.addMessage(
            ownerId,
            activeChatSessionId,
            "assistant",
            mealHandled.message
          );
        }

        console.info(
          `[chat-route] fallback-hit: meal${safeMealFallback ? " (safe)" : ""}`
        );
        if (responseMode === "stream") {
          return makeTextStreamResponse({
            message: mealHandled.message,
            sessionId: parsed.sessionId,
            chatSessionId: activeChatSessionId,
            requestId,
          });
        }

        return NextResponse.json({
          sessionId: parsed.sessionId,
          chatSessionId: activeChatSessionId,
          message: mealHandled.message,
          choices: mealHandled.choices ?? [],
          action: mealHandled.action,
          requestId,
        });
      }

      if (fallbackFirst) {
        const handled = await tryHandleGroceryCommand(
          parsed.message,
          parsed.pageContextData,
          activeChatSessionId,
          ownerId
        );
        if (handled) {
          if (shouldPersist && activeChatSessionId) {
            await historyService.addMessage(
              ownerId,
              activeChatSessionId,
              "assistant",
              handled.message
            );
          }

          console.info("[chat-route] fallback-hit: grocery");
          if (responseMode === "stream") {
            return makeTextStreamResponse({
              message: handled.message,
              sessionId: parsed.sessionId,
              chatSessionId: activeChatSessionId,
              requestId,
            });
          }

          return NextResponse.json({
            sessionId: parsed.sessionId,
            chatSessionId: activeChatSessionId,
            message: handled.message,
            choices: handled.choices ?? [],
            action: handled.action,
            requestId,
          });
        }
      }
    }

    // Phase D — load persisted copilotSessionId; Phase E — pass reasoningEffort
    let copilotSessionId = parsed.sessionId ?? undefined;
    if (!copilotSessionId && activeChatSessionId) {
      const persisted =
        await historyService.getCopilotSessionId(ownerId, activeChatSessionId);
      if (persisted) copilotSessionId = persisted;
    }

    const reasoningEffort =
      (prefs?.reasoningEffort as ReasoningEffort) || undefined;

    const chefResponse = await chef.chat(
      parsed.message,
      copilotSessionId,
      parsed.pageContext,
      reasoningEffort
    );

    console.info("[chat-route] sdk-path");

    if ("action" in chefResponse) {
      if (shouldPersist && activeChatSessionId) {
        await historyService.addMessage(
          ownerId,
          activeChatSessionId,
          "assistant",
          chefResponse.message
        );
      }

      // Persist copilotSessionId mapping for owner-bound lifecycle routes.
      if (activeChatSessionId) {
        await historyService.setCopilotSessionId(
          ownerId,
          activeChatSessionId,
          chefResponse.sessionId
        );
      }

      if (responseMode === "stream") {
        return makeTextStreamResponse({
          message: chefResponse.message,
          sessionId: chefResponse.sessionId,
          chatSessionId: activeChatSessionId,
          requestId,
        });
      }

      return NextResponse.json({
        sessionId: chefResponse.sessionId,
        chatSessionId: activeChatSessionId,
        message: chefResponse.message,
        choices: [],
        action: chefResponse.action,
        requestId,
      });
    }

    const { sessionId, stream } = chefResponse;

    // Persist copilotSessionId mapping
    if (activeChatSessionId) {
      await historyService.setCopilotSessionId(ownerId, activeChatSessionId, sessionId);
    }

    // Tee the stream: one branch for the client, one to capture and save the full response.
    const [clientStream, captureStream] = stream.tee();

    const snapshotId = activeChatSessionId;
    (async () => {
      const fullText = await readTextFromStream(captureStream);
      if (shouldPersist && snapshotId) {
        await historyService.addMessage(
          ownerId,
          snapshotId,
          "assistant",
          fullText.trim()
        );
      }
    })().catch(console.error);

    if (responseMode === "json") {
      const message = (await readTextFromStream(clientStream)).trim();
      return NextResponse.json({
        sessionId,
        chatSessionId: activeChatSessionId,
        message,
        choices: [],
        requestId,
      });
    }

    return new Response(clientStream, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "x-session-id": sessionId,
        "x-request-id": requestId,
        ...(activeChatSessionId
          ? { "x-chat-session-id": activeChatSessionId }
          : {}),
      },
    });
  } catch (error) {
    if (error instanceof MachineAuthError) {
      return NextResponse.json(
        { error: error.message, requestId },
        { status: error.status }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unable to handle chat request";
    const stack =
      process.env.NODE_ENV !== "production" && error instanceof Error
        ? error.stack
        : undefined;

    return NextResponse.json({ error: message, stack, requestId }, { status: 400 });
  }
}
