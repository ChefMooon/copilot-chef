import { describe, expect, it } from "vitest";

import {
  rebindMealId,
  discardLastOfType,
  MAX_STACK_SIZE,
  type MealUndoAction,
} from "./use-meal-undo-redo";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(overrides?: Partial<{ name: string; date: string; mealType: string }>) {
  return {
    name: overrides?.name ?? "Test Meal",
    date: overrides?.date ?? "2026-03-19T12:00:00.000Z",
    mealType: overrides?.mealType ?? "DINNER",
    notes: null,
    ingredients: [],
  };
}

function simulateRecordAction(
  undoStack: MealUndoAction[],
  redoStack: MealUndoAction[],
  action: MealUndoAction,
  maxSize = MAX_STACK_SIZE,
) {
  undoStack.push(action);
  if (undoStack.length > maxSize) {
    undoStack.splice(0, undoStack.length - maxSize);
  }
  redoStack.length = 0;
}

// ---------------------------------------------------------------------------
// rebindMealId
// ---------------------------------------------------------------------------

describe("rebindMealId", () => {
  it("rebinds add action mealId", () => {
    const stack: MealUndoAction[] = [
      { type: "add", mealId: "old", snapshot: makeSnapshot(), summary: "add" },
    ];
    rebindMealId(stack, "old", "new");
    expect((stack[0] as Extract<MealUndoAction, { type: "add" }>).mealId).toBe("new");
  });

  it("rebinds delete action mealId", () => {
    const stack: MealUndoAction[] = [
      { type: "delete", mealId: "old", snapshot: makeSnapshot(), summary: "delete" },
    ];
    rebindMealId(stack, "old", "new");
    expect((stack[0] as Extract<MealUndoAction, { type: "delete" }>).mealId).toBe("new");
  });

  it("rebinds move action mealId", () => {
    const stack: MealUndoAction[] = [
      {
        type: "move",
        mealId: "old",
        fromDate: "d1",
        fromType: "DINNER",
        toDate: "d2",
        toType: "LUNCH",
        summary: "move",
      },
    ];
    rebindMealId(stack, "old", "new");
    expect((stack[0] as Extract<MealUndoAction, { type: "move" }>).mealId).toBe("new");
  });

  it("rebinds both meal IDs in swap action", () => {
    const stack: MealUndoAction[] = [
      {
        type: "swap",
        meal1Id: "a",
        meal1Date: "d1",
        meal1Type: "DINNER",
        meal2Id: "a",
        meal2Date: "d2",
        meal2Type: "LUNCH",
        summary: "swap",
      },
    ];
    rebindMealId(stack, "a", "b");
    const swap = stack[0] as Extract<MealUndoAction, { type: "swap" }>;
    expect(swap.meal1Id).toBe("b");
    expect(swap.meal2Id).toBe("b");
  });

  it("only rebinds the matching meal ID in swap", () => {
    const stack: MealUndoAction[] = [
      {
        type: "swap",
        meal1Id: "old",
        meal1Date: "d1",
        meal1Type: "DINNER",
        meal2Id: "keep",
        meal2Date: "d2",
        meal2Type: "LUNCH",
        summary: "swap",
      },
    ];
    rebindMealId(stack, "old", "new");
    const swap = stack[0] as Extract<MealUndoAction, { type: "swap" }>;
    expect(swap.meal1Id).toBe("new");
    expect(swap.meal2Id).toBe("keep");
  });

  it("does not rebind non-matching IDs", () => {
    const stack: MealUndoAction[] = [
      { type: "add", mealId: "keep", snapshot: makeSnapshot(), summary: "add" },
    ];
    rebindMealId(stack, "old", "new");
    expect((stack[0] as Extract<MealUndoAction, { type: "add" }>).mealId).toBe("keep");
  });

  it("handles empty stack", () => {
    const stack: MealUndoAction[] = [];
    rebindMealId(stack, "old", "new");
    expect(stack).toHaveLength(0);
  });

  it("rebinds across multiple actions in one pass", () => {
    const stack: MealUndoAction[] = [
      { type: "add", mealId: "x", snapshot: makeSnapshot(), summary: "add" },
      {
        type: "move",
        mealId: "x",
        fromDate: "d1",
        fromType: "DINNER",
        toDate: "d2",
        toType: "LUNCH",
        summary: "move",
      },
    ];
    rebindMealId(stack, "x", "y");
    expect((stack[0] as Extract<MealUndoAction, { type: "add" }>).mealId).toBe("y");
    expect((stack[1] as Extract<MealUndoAction, { type: "move" }>).mealId).toBe("y");
  });
});

// ---------------------------------------------------------------------------
// discardLastOfType
// ---------------------------------------------------------------------------

describe("discardLastOfType", () => {
  it("removes the most recent action of given type", () => {
    const stack: MealUndoAction[] = [
      { type: "add", mealId: "1", snapshot: makeSnapshot(), summary: "first add" },
      { type: "delete", mealId: "2", snapshot: makeSnapshot(), summary: "delete" },
      { type: "add", mealId: "3", snapshot: makeSnapshot(), summary: "second add" },
    ];
    const result = discardLastOfType(stack, "add");
    expect(result).toBe(true);
    expect(stack).toHaveLength(2);
    expect(stack[0].summary).toBe("first add");
    expect(stack[1].summary).toBe("delete");
  });

  it("returns false when no matching type exists", () => {
    const stack: MealUndoAction[] = [
      { type: "add", mealId: "1", snapshot: makeSnapshot(), summary: "add" },
    ];
    expect(discardLastOfType(stack, "delete")).toBe(false);
    expect(stack).toHaveLength(1);
  });

  it("returns false for empty stack", () => {
    expect(discardLastOfType([], "add")).toBe(false);
  });

  it("removes only one action even when multiple match", () => {
    const stack: MealUndoAction[] = [
      { type: "delete", mealId: "1", snapshot: makeSnapshot(), summary: "d1" },
      { type: "delete", mealId: "2", snapshot: makeSnapshot(), summary: "d2" },
      { type: "delete", mealId: "3", snapshot: makeSnapshot(), summary: "d3" },
    ];
    discardLastOfType(stack, "delete");
    expect(stack).toHaveLength(2);
    expect(stack[0].summary).toBe("d1");
    expect(stack[1].summary).toBe("d2");
  });
});

// ---------------------------------------------------------------------------
// Stack operations (simulate hook logic with plain arrays)
// ---------------------------------------------------------------------------

describe("stack operations", () => {
  it("recordAction pushes to undo stack and clears redo stack", () => {
    const undo: MealUndoAction[] = [];
    const redo: MealUndoAction[] = [
      { type: "add", mealId: "r1", snapshot: makeSnapshot(), summary: "redo item" },
    ];
    simulateRecordAction(undo, redo, {
      type: "add",
      mealId: "1",
      snapshot: makeSnapshot(),
      summary: "add",
    });
    expect(undo).toHaveLength(1);
    expect(redo).toHaveLength(0);
  });

  it("caps undo stack at MAX_STACK_SIZE", () => {
    const undo: MealUndoAction[] = [];
    const redo: MealUndoAction[] = [];
    for (let i = 0; i < MAX_STACK_SIZE + 5; i++) {
      simulateRecordAction(undo, redo, {
        type: "add",
        mealId: `id-${i}`,
        snapshot: makeSnapshot(),
        summary: `add ${i}`,
      });
    }
    expect(undo).toHaveLength(MAX_STACK_SIZE);
    expect((undo[0] as Extract<MealUndoAction, { type: "add" }>).mealId).toBe("id-5");
  });

  it("simulated undo moves action from undo to redo stack", () => {
    const undo: MealUndoAction[] = [
      {
        type: "move",
        mealId: "m1",
        fromDate: "d1",
        fromType: "DINNER",
        toDate: "d2",
        toType: "LUNCH",
        summary: "move",
      },
    ];
    const redo: MealUndoAction[] = [];

    const action = undo.pop()!;
    redo.push(action);

    expect(undo).toHaveLength(0);
    expect(redo).toHaveLength(1);
    expect(redo[0].summary).toBe("move");
  });

  it("simulated redo moves action from redo to undo stack", () => {
    const undo: MealUndoAction[] = [];
    const redo: MealUndoAction[] = [
      {
        type: "move",
        mealId: "m1",
        fromDate: "d1",
        fromType: "DINNER",
        toDate: "d2",
        toType: "LUNCH",
        summary: "move",
      },
    ];

    const action = redo.pop()!;
    undo.push(action);

    expect(redo).toHaveLength(0);
    expect(undo).toHaveLength(1);
  });

  it("ID rebinding after simulated undo of delete (re-create gets new ID)", () => {
    const undo: MealUndoAction[] = [
      {
        type: "move",
        mealId: "abc",
        fromDate: "d1",
        fromType: "DINNER",
        toDate: "d2",
        toType: "LUNCH",
        summary: "move abc",
      },
      { type: "delete", mealId: "abc", snapshot: makeSnapshot(), summary: "delete abc" },
    ];
    const redo: MealUndoAction[] = [];

    // Simulate undo of delete: pop → re-create meal (server returns new ID "xyz") → rebind
    const action = undo.pop()! as Extract<MealUndoAction, { type: "delete" }>;
    const oldId = action.mealId;
    const newId = "xyz";
    action.mealId = newId;

    rebindMealId(redo, oldId, newId);
    redo.push(action);
    rebindMealId(undo, oldId, newId);

    // The move action in undo should now reference "xyz"
    expect((undo[0] as Extract<MealUndoAction, { type: "move" }>).mealId).toBe("xyz");
    // The delete action in redo should reference "xyz"
    expect((redo[0] as Extract<MealUndoAction, { type: "delete" }>).mealId).toBe("xyz");
  });

  it("ID rebinding after simulated redo of add (re-create gets new ID)", () => {
    const undo: MealUndoAction[] = [];
    const redo: MealUndoAction[] = [
      { type: "add", mealId: "abc", snapshot: makeSnapshot(), summary: "add abc" },
      {
        type: "move",
        mealId: "abc",
        fromDate: "d1",
        fromType: "DINNER",
        toDate: "d2",
        toType: "LUNCH",
        summary: "move abc",
      },
    ];

    // Simulate redo of add: pop → re-create (new ID "def") → rebind
    // Note: redo is a stack, so pop gives last element. But in the hook,
    // the add action would be at the end of redo after undo. Let's re-arrange:
    redo.length = 0;
    redo.push(
      {
        type: "move",
        mealId: "abc",
        fromDate: "d1",
        fromType: "DINNER",
        toDate: "d2",
        toType: "LUNCH",
        summary: "move abc",
      },
      { type: "add", mealId: "abc", snapshot: makeSnapshot(), summary: "add abc" },
    );

    const addAction = redo.pop()! as Extract<MealUndoAction, { type: "add" }>;
    const oldId = addAction.mealId;
    const newId = "def";
    addAction.mealId = newId;

    rebindMealId(undo, oldId, newId);
    undo.push(addAction);
    rebindMealId(redo, oldId, newId);

    // Move action still in redo should now reference "def"
    expect((redo[0] as Extract<MealUndoAction, { type: "move" }>).mealId).toBe("def");
    // Add action in undo should reference "def"
    expect((undo[0] as Extract<MealUndoAction, { type: "add" }>).mealId).toBe("def");
  });

  it("new action recorded after undo clears entire redo stack", () => {
    const undo: MealUndoAction[] = [];
    const redo: MealUndoAction[] = [
      { type: "add", mealId: "1", snapshot: makeSnapshot(), summary: "add1" },
      {
        type: "move",
        mealId: "1",
        fromDate: "d1",
        fromType: "DINNER",
        toDate: "d2",
        toType: "LUNCH",
        summary: "move1",
      },
    ];

    simulateRecordAction(undo, redo, {
      type: "delete",
      mealId: "2",
      snapshot: makeSnapshot(),
      summary: "delete2",
    });

    expect(redo).toHaveLength(0);
    expect(undo).toHaveLength(1);
  });

  it("multi-step undo/redo cycle with ID rebinding stays consistent", () => {
    const undo: MealUndoAction[] = [];
    const redo: MealUndoAction[] = [];

    // 1. User adds meal "abc"
    simulateRecordAction(undo, redo, {
      type: "add",
      mealId: "abc",
      snapshot: makeSnapshot({ name: "Pasta" }),
      summary: "Added Pasta",
    });

    // 2. User moves meal "abc"
    simulateRecordAction(undo, redo, {
      type: "move",
      mealId: "abc",
      fromDate: "d1",
      fromType: "DINNER",
      toDate: "d2",
      toType: "LUNCH",
      summary: "Moved Pasta",
    });

    expect(undo).toHaveLength(2);
    expect(redo).toHaveLength(0);

    // 3. Undo move
    const moveAction = undo.pop()!;
    redo.push(moveAction);

    // 4. Undo add (simulates DELETE then push to redo)
    const addAction = undo.pop()! as Extract<MealUndoAction, { type: "add" }>;
    redo.push(addAction);

    expect(undo).toHaveLength(0);
    expect(redo).toHaveLength(2);

    // 5. Redo add (simulates POST re-create, new ID "def")
    const redoAdd = redo.pop()! as Extract<MealUndoAction, { type: "add" }>;
    redoAdd.mealId = "def";
    rebindMealId(undo, "abc", "def");
    undo.push(redoAdd);
    rebindMealId(redo, "abc", "def");

    // The move action in redo should now reference "def"
    expect((redo[0] as Extract<MealUndoAction, { type: "move" }>).mealId).toBe("def");

    // 6. Redo move
    const redoMove = redo.pop()!;
    undo.push(redoMove);

    expect(undo).toHaveLength(2);
    expect(redo).toHaveLength(0);
    expect((undo[0] as Extract<MealUndoAction, { type: "add" }>).mealId).toBe("def");
    expect((undo[1] as Extract<MealUndoAction, { type: "move" }>).mealId).toBe("def");
  });

  it("discardLast after toast undo prevents double-undo", () => {
    const undo: MealUndoAction[] = [];
    const redo: MealUndoAction[] = [];

    // User adds a meal then deletes it
    simulateRecordAction(undo, redo, {
      type: "add",
      mealId: "a1",
      snapshot: makeSnapshot(),
      summary: "Added Salad",
    });
    simulateRecordAction(undo, redo, {
      type: "delete",
      mealId: "a1",
      snapshot: makeSnapshot(),
      summary: "Deleted Salad",
    });

    expect(undo).toHaveLength(2);

    // Toast undo button clicked → restore meal → discard delete from stack
    discardLastOfType(undo, "delete");

    expect(undo).toHaveLength(1);
    expect(undo[0].type).toBe("add");

    // Ctrl+Z now undoes the add, not the (already toast-restored) delete
    const action = undo.pop()!;
    expect(action.type).toBe("add");
    expect(action.summary).toBe("Added Salad");
  });
});
