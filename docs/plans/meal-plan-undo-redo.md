# Meal Plan Undo/Redo

## Overview

Client-side, ephemeral undo/redo for meal plan actions (add, delete, move, swap) triggered by keyboard shortcuts. The history lives in memory and is cleared on page navigation or browser refresh.

This is **separate from** the server-side chat action history in `CopilotChef`, which persists undo/redo state per chat session in the database.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Z` / `Cmd+Z` | Undo last action |
| `Ctrl+Y` / `Cmd+Y` / `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo last undone action |

Shortcuts are **disabled** when:

- The meal edit modal or delete confirmation modal is open
- Focus is on an `<input>`, `<textarea>`, or `[contenteditable]` element

## Tracked Actions

| Action | Undo | Redo |
|---|---|---|
| **Add meal** | Deletes the created meal | Re-creates from snapshot (new server ID) |
| **Delete meal** | Re-creates from snapshot (new server ID) | Deletes the restored meal |
| **Move meal** | Patches meal back to original date/type | Patches meal to target date/type |
| **Swap meals** | Patches both meals back to original positions | Patches both to swapped positions |

**Not tracked:** Editing meal name, notes, or ingredients via the edit modal.

## Architecture

### Hook: `useMealUndoRedo`

Located at `src/web/src/app/meal-plan/use-meal-undo-redo.ts`.

- **Stacks**: Two `useRef<MealUndoAction[]>` arrays (undo and redo), stored in memory only
- **`recordAction(action)`**: Pushes to undo stack, clears redo stack, caps at 50 entries
- **`undo()` / `redo()`**: Async — executes the inverse/forward API call, moves the action between stacks, invalidates React Query cache, shows toast confirmation
- **`discardLast(type)`**: Removes the most recent action of a given type from the undo stack (used for toast reconciliation)
- **`canUndo` / `canRedo`**: Boolean flags derived from stack lengths

### ID Rebinding

When undo/redo re-creates a meal via POST, the server assigns a **new ID**. The hook scans both stacks and replaces all references to the old ID with the new one. This ensures multi-step undo/redo chains remain consistent even after ID changes.

Example:

1. User adds Pasta → server returns ID `abc`
2. User moves Pasta (`abc`) to Tuesday
3. Ctrl+Z (undo move) → Pasta back to Monday
4. Ctrl+Z (undo add) → Pasta deleted
5. Ctrl+Y (redo add) → server returns **new** ID `def`, move action in redo stack is rebound from `abc` → `def`
6. Ctrl+Y (redo move) → uses `def` correctly

### Toast Reconciliation

The existing delete toast with "Undo" button is **unchanged**. To prevent double-undo:

1. Delete records to the undo stack **and** shows the toast
2. If user clicks toast "Undo" → meal restored, `discardLast("delete")` removes the delete action from the undo stack
3. If user presses `Ctrl+Z` instead → `deletedMealRef` is cleared (disabling the toast button), and the hook performs the undo

## Integration Points

The hook is wired into `page.tsx` at each mutation callback:

- `onSaveMeal` (create path only) — records `"add"` action with the new server ID
- `onDeleteMeal` — records `"delete"` action with meal snapshot
- `onConfirmTrashDelete` — records `"delete"` action with meal snapshot
- `onMoveMeal` — records `"move"` action with from/to positions
- `onSwapMeals` — records `"swap"` action with both meals' original positions

A `keydown` event listener on `window` dispatches to `undo()` / `redo()`.

## Files

| File | Role |
|---|---|
| `src/web/src/app/meal-plan/use-meal-undo-redo.ts` | Hook + exported pure helpers |
| `src/web/src/app/meal-plan/use-meal-undo-redo.test.ts` | Unit tests for pure helpers and stack logic |
| `src/web/src/app/meal-plan/page.tsx` | Integration (mutation callbacks, keyboard listener) |

## Scope Boundaries

- **Included**: add, delete, move, swap — the actions a user performs via the calendar UI
- **Excluded**: editing meal name/notes/ingredients (modal saves), AI-generated meal plan suggestions, grocery list mutations
- **Ephemeral**: history is cleared on page navigation or refresh; nothing is persisted
- **Keybind-only**: no undo/redo UI buttons; keyboard shortcuts are the sole trigger
