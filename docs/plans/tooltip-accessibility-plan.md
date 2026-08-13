## Plan: Reusable Tooltip and Button Accessibility Audit

I created the detailed plan and persisted it to session memory at `/memories/session/plan.md`. It is scoped as a companion to `icon-upgrade.md`, with the tooltip/accessibility foundation implementable before the Phosphor icon sweep.

**Recommended approach**

Use `@radix-ui/react-tooltip`, following the repository’s existing Radix wrapper pattern. Add a shared renderer primitive under `src/renderer/components/ui/tooltip.tsx`, mount one provider in `app.tsx`, and keep tooltip content supplementary to visible labels and accessible names.

Tooltips should be required for icon-only or unfamiliar controls, but not added redundantly to every clearly labeled button.

**Implementation phases**

1. **Baseline and contract**
   - Inventory every button and button-like control across the established eleven-route QA order.
   - Classify controls as visible-label, icon-only, unfamiliar, decorative, visualization, user content, or drag-only.
   - Define the tooltip policy, accessible-name rules, touch behavior, focus behavior, and minimum hit-area target.
   - Recommended minimum: 32px for compact icon controls and 40px for standard icon buttons.

2. **Reusable tooltip primitive**
   - Add `@radix-ui/react-tooltip`.
   - Create the shared tooltip wrapper and semantic theme styling.
   - Support pointer hover, keyboard focus, escape dismissal, portal rendering, collision-aware placement, reduced motion, dark mode, and custom-theme tokens.
   - Keep tooltip text independent from `aria-label` and visible button text.
   - Add focused tests for `role="tooltip"`, `aria-describedby`, focus/hover behavior, disabled triggers, portals, and tooltip-only-name prevention.

3. **Shared control contract**
   - Extend the QA helpers in `qa`.
   - Add checks for accessible names, `aria-hidden` decorative icons, focus visibility, keyboard activation, hit areas, and tooltip policy.
   - Keep `Button` in `button.tsx` focused on styling and focus behavior instead of forcing tooltip props onto every button.
   - Update the style guide and browser QA documentation once the primitive contract is settled.

4. **Highest-risk accessibility fixes**
   - Replace title-only naming on icon-only controls.
   - Make hover-only controls visible and reachable on keyboard focus.
   - Remove nested interactive buttons in `PersonaGrid` and `ListsSidebar`.
   - Repair the drag-only `TrashDropZone` semantics.
   - Add the missing accessible name to `ToggleSwitch` through `ToggleRow`.
   - Add selected-state semantics to segmented controls.
   - Add recipe-specific labels to selection checkboxes.
   - Preserve visible labels for high-consequence actions.

5. **Route-group audit**
   - Meal Plan: calendar actions, meal-bank controls, modal actions, reorder controls, drag/drop, undo/redo, export, and close buttons.
   - Recipes: favourite/edit/delete, filter clearing, photo zoom, servings controls, recipe selection, reorder actions, and modal controls.
   - Grocery and Prep: audit together because they repeat the same favourite, reorder, delete, expand, modal-close, and list-row patterns.
   - Settings: persona, chip, modal, toggle, segmented-control, and QR-access controls.
   - Home and Stats: keep chart and heatmap tooltip systems separate, but verify their buttons remain named and their information is not hover-only.
   - Connect, shopping, and prep-detail routes: verify shared controls and ensure touch workflows do not depend on tooltips.

6. **Verification**
   - Run focused tests after each route group.
   - Add tooltip and control-accessibility tests alongside existing shell, recipe, meal-plan, settings, and prep tests.
   - Run `npm run test`, `npm run lint`, `npm run build:web`, and `npm run build`.
   - Execute the browser QA route order at desktop and narrow widths using `npm run dev:web`.
   - Check pointer, keyboard, and touch-oriented behavior, light/dark themes, focus rings, hit areas, nested controls, and disabled-state contrast.
   - Keep heatmap/chart tooltips, QR SVGs, persona emoji, swatches, and packaged branding outside the reusable UI tooltip contract.

**Important findings carried forward**

- No shared tooltip primitive currently exists.
- `Button` has no tooltip or icon-only accessibility contract.
- Native `title` attributes are widespread but unreliable for keyboard and touch users.
- Heatmap tooltips are custom visualization behavior and should not become the general control primitive.
- Several icon-only controls rely on `title` alone.
- `PersonaGrid` and `ListsSidebar` contain nested interactive controls.
- Some controls are hidden on hover and remain inaccessible through keyboard focus.
- `ToggleSwitch` and segmented controls have related accessibility gaps.
- The repository does not currently include Playwright, axe, or coverage tooling, so the plan uses Vitest/Testing Library plus manual browser QA.
