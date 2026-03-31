> Historical note: This document is retained as planning history. It references older component locations and migration context and should be used for background only.

# Modal Portal Migration Plan

## Overview

Standardize all modals across the Copilot Chef app to use React `createPortal` for rendering, improving z-index stacking, scroll behavior, and SSR safety.

**Reference Implementation**: [`src/web/src/components/recipes/AddRecipeModal.tsx`](../../src/web/src/components/recipes/AddRecipeModal.tsx)

---

## Current State Analysis

| Modal | Location | Status | Issues |
|-------|----------|--------|--------|
| **AddRecipeModal** | `src/web/src/components/recipes/AddRecipeModal.tsx` | ✅ Migrated | Portal-mounted, scroll-locked, z-[500] |
| **IngestModal** | `src/web/src/components/recipes/IngestModal.tsx` | ❌ Inline | z-[101], no scroll lock, inline render |
| **EditModal** | `src/web/src/app/meal-plan/components/EditModal.tsx` | ❌ Inline | No scroll lock, CSS module styles, inline render |
| **DeleteConfirmationModal** | `src/web/src/app/meal-plan/components/DeleteConfirmationModal.tsx` | ❌ Inline | Conditional render, no scroll lock |
| **NewListModal** | `src/web/src/app/grocery-list/components/NewListModal.tsx` | ❌ Inline | CSS module overlay, no scroll lock, inline render |
| **PersonaModal** | `src/web/src/components/settings/PersonaModal.tsx` | ❌ Inline | No scroll lock, inline render |

---

## Key Improvements from Portal Migration

1. **Z-Index Stacking** — Portal removes modal from page-level stacking context, preventing z-index conflicts
2. **Body Scroll Lock** — Prevents background page scroll while modal open
3. **Consistent Layout** — Fixed header / scrollable body / fixed footer structure
4. **SSR Safety** — Guards with `portalRoot` state prevent hydration mismatches
5. **Framework Isolation** — Escapes relative-positioned ancestors

---

## Migration Pattern (Reference: AddRecipeModal)

### Step 1: Add React Portal Imports
```typescript
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
```

### Step 2: Add Portal Root State
Guard against SSR rendering by mounting portal root only on client:
```typescript
const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

useEffect(() => {
  setPortalRoot(document.body);
}, []);
```

### Step 3: Add Body Scroll Lock
Lock and restore body overflow while modal is open:
```typescript
useEffect(() => {
  if (!open || !portalRoot) return;

  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  return () => {
    document.body.style.overflow = originalOverflow;
  };
}, [open, portalRoot]);
```

### Step 4: Restructure Modal Layout
Replace single scrollable container with fixed header/body/footer structure:
```typescript
// BEFORE: All content in single scrollable div
<div className={styles.modalBody}>
  {/* all form content */}
</div>

// AFTER: Fixed header, scrollable body, fixed footer
<div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 p-4">
  <div className="flex flex-col max-h-[90vh] rounded">
    {/* Fixed header with border-b */}
    <div className="flex-shrink-0 border-b">
      {/* header content */}
    </div>
    
    {/* Scrollable body */}
    <div className="flex-1 overflow-y-auto">
      {/* form content */}
    </div>
    
    {/* Fixed footer with border-t */}
    <div className="flex-shrink-0 border-t">
      {/* action buttons */}
    </div>
  </div>
</div>
```

### Step 5: Wrap Render in Portal
Add guard check and portal mount:
```typescript
// Early return if not ready
if (!open || !portalRoot) {
  return null;
}

// Portal render
return createPortal(
  <div className="fixed inset-0 z-[500] ...">
    {/* modal content */}
  </div>,
  portalRoot
);
```

---

## Migration Tasks

### Phase 1: EditModal (Meal Plan) — HIGH PRIORITY
**File**: `src/web/src/app/meal-plan/components/EditModal.tsx`

**Scope**:
- Migrate to portal rendering
- Add body scroll lock
- Restructure form into fixed header/scrollable body/fixed footer
- Update z-index to `z-[500]`
- Update overlay alignment from `items-start` to `items-center`
- Keep all existing functionality (delete confirmation, AI re-suggest, form validation)

**Key Considerations**:
- Parent render is conditional (EditModal only renders if `editMeal` exists)
- DeleteConfirmationModal is nested child—handle independently or inline
- Form state management unchanged
- CSS module usage (`styles.modalOverlay`, etc.) remains valid for other components

---

### Phase 2: IngestModal (Recipe Import) — MEDIUM PRIORITY
**File**: `src/web/src/components/recipes/IngestModal.tsx`

**Scope**:
- Migrate to portal rendering
- Add body scroll lock
- Inline Tailwind classes instead of no-class approach
- Update z-index to `z-[500]`
- Restructure into fixed header/body/footer if content warrants scrolling

**Key Considerations**:
- Simple, lightweight modal with just 3 form fields
- Parent render is conditional similar to EditModal
- No nested child modals
- Currently uses Tailwind; ensure consistency

---

### Phase 3: NewListModal (Grocery List) — MEDIUM PRIORITY
**File**: `src/web/src/app/grocery-list/components/NewListModal.tsx`

**Scope**:
- Migrate to portal rendering
- Add body scroll lock
- Replace CSS module overlay with Tailwind classes for consistency
- Update z-index to `z-[500]`
- Restructure into fixed header/body/footer

**Key Considerations**:
- Currently uses CSS module (`styles.modalOverlay`, `styles.newListModal`, etc.)
- Simple form (name + date inputs)
- Parent render is conditional (ternary in parent JSX)

---

### Phase 4: PersonaModal (Settings) — MEDIUM PRIORITY
**File**: `src/web/src/components/settings/PersonaModal.tsx`

**Scope**:
- Migrate to portal rendering
- Add body scroll lock
- Restructure into fixed header/scrollable body/fixed footer
- Update z-index to `z-[500]`
- Keep conditional render pattern (controlled by parent mode)

**Key Considerations**:
- Complex form with emoji, title, description, prompt fields
- Mode prop determines create vs. edit behavior
- Save and delete handlers with loading states
- Error state display

---

### Phase 5: DeleteConfirmationModal (Nested) — LOW PRIORITY
**File**: `src/web/src/app/meal-plan/components/DeleteConfirmationModal.tsx`

**Scope**:
- Migrate to portal rendering
- Add body scroll lock
- Update z-index to `z-[501]` (above parent EditModal's `z-[500]`)
- Restructure into fixed header/body/footer if needed

**Key Considerations**:
- Currently controlled by `isOpen` boolean prop (not open/closed trigger via presence)
- Rendered alongside EditModal (both inline)
- Simple confirmation dialog—minimal content
- Should stack above parent EditModal when open

---

## Testing Checklist

For each modal migration, verify:

- [ ] Portal mounts correctly to `document.body`
- [ ] Modal is centered on screen
- [ ] Body scroll lock engages when modal opens, releases when closed
- [ ] Escape key closes modal (if applicable)
- [ ] Overlay click closes modal (if applicable)
- [ ] Fixed header stays visible while scrolling form
- [ ] Fixed footer stays visible while scrolling form
- [ ] Z-index stacking is correct (no overlap issues, nested modals rank correctly)
- [ ] Form validation and submission still work
- [ ] Delete/confirm buttons trigger correct handlers
- [ ] Loading states display correctly
- [ ] Error messages display and dismiss correctly
- [ ] Mobile responsive (modal fits in viewport, scrolls on small screens)
- [ ] No TypeScript errors or type mismatches
- [ ] Build passes: `npm run build --workspace @copilot-chef/web`
- [ ] Tests pass: `npm run test --workspace @copilot-chef/web`

---

## Implementation Order

1. **EditModal** — Highest impact, used frequently on meal-plan page
2. **PersonaModal** — Used on settings page, moderate complexity
3. **NewListModal** — Used on grocery-list page, simple form
4. **IngestModal** — Used on recipes page, simple form
5. **DeleteConfirmationModal** — Nested modal, refine after parent EditModal done

---

## Rollback Plan

If issues arise:
- Remove `createPortal` wrapper and revert to inline render
- Remove `portalRoot` state and effect
- Remove body scroll lock effect
- Restore original single-container layout
- Revert z-index changes

---

## Long-Term Benefits

- **Consistency** — All modals follow same pattern
- **Testability** — Predictable portal structure makes unit testing easier
- **Extensibility** — Future modals can be templated from working example
- **Maintainability** — Single pattern to understand and debug
- **UX** — Better scroll behavior and z-stacking resolve user friction

---

## Files to Update

| File | Change Type | Priority |
|------|-------------|----------|
| `src/web/src/app/meal-plan/components/EditModal.tsx` | Portal migration + layout restructure | HIGH |
| `src/web/src/components/recipes/IngestModal.tsx` | Portal migration | MED |
| `src/web/src/app/grocery-list/components/NewListModal.tsx` | Portal migration + CSS→Tailwind | MED |
| `src/web/src/components/settings/PersonaModal.tsx` | Portal migration + layout restructure | MED |
| `src/web/src/app/meal-plan/components/DeleteConfirmationModal.tsx` | Portal migration | LOW |

---

## Notes

- **Reference**: Study `AddRecipeModal.tsx` for exact portal patterns, scroll lock implementation, and SSR guards
- **Styling**: Prefer Tailwind classes over CSS modules for consistency (Ingest and NewList modals can move away from modules if desired)
- **Z-Index Layer**: Use `z-[500]` for primary modals, `z-[501]` for nested/confirmation overlays
- **Scroll Behavior**: Fixed header/footer split prevents layout shift and keeps buttons visible on long forms
- **SSR Safety**: Always guard `portalRoot` in render to avoid hydration errors
