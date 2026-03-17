# Copilot Chef Design System

Last updated: 2026-03-17
Owner: Product + Frontend Engineering
Source pages audited: Home, Meal Plan, Grocery List, Stats, Settings

## Purpose and scope

This document defines the production visual system currently implemented in the first five core pages. New pages should match these standards unless a future design version explicitly updates them.

Primary source files:

- src/web/src/app/globals.css
- src/web/src/components/layout/app-shell.module.css
- src/web/src/components/home/home-dashboard.module.css
- src/web/src/app/meal-plan/meal-plan.module.css
- src/web/src/app/grocery-list/grocery-list.module.css
- src/web/src/components/stats/*.tsx
- src/web/src/components/settings/settings.module.css
- src/web/src/components/ui/button.tsx
- src/web/tailwind.config.ts

## Design principles

- Warm utility: practical planning UI with culinary warmth.
- Soft structure: rounded cards, cream surfaces, low-contrast borders.
- Data-first: charts and progress indicators should be legible before decorative details.
- Consistent density: compact controls and tight spacing for high information pages.

## Color system

### Core tokens

Defined in src/web/src/app/globals.css.

| Token | Hex | Role |
| --- | --- | --- |
| --green | #3B5E45 | Primary brand color, selected states, default buttons |
| --green-light | #5A7D63 | Hover state for green controls |
| --green-pale | #D4E4D8 | Soft highlight backgrounds |
| --cream | #F5F0E8 | App base background, form surfaces |
| --cream-dark | #EDE6D6 | Borders, dividers, neutral tracks |
| --orange | #C5622A | Accent color, eyebrow labels, accent CTA buttons |
| --orange-light | #E8885A | Orange hover state |
| --text | #2C2416 | Primary text |
| --text-muted | #7A6A58 | Secondary text and metadata |
| --white | #FFFDF8 | Primary card surface |

### Semantic aliases

Also defined in src/web/src/app/globals.css for utility frameworks and shared UI primitives.

- --background: #F5F0E8
- --foreground: #2C2416
- --card: #FFFDF8
- --primary: #3B5E45
- --secondary: #D4E4D8
- --accent: #C5622A
- --border: #EDE6D6
- --radius: 10px

### Data visualization palette

Current chart and heatmap palette used by Home and Stats.

- Heatmap levels: #E4DDD0, #A8C8B0, #6FA882, #3B5E45
- Bar/area variants: #3B5E45, #4D7A5A, #6FA882, #A8C8B0, #C5DDC9, #E4DDD0

### Elevation

- --shadow: 0 2px 12px rgba(44, 36, 22, 0.1)
- --shadow-lg: 0 6px 28px rgba(44, 36, 22, 0.14)

Use --shadow for standard cards and --shadow-lg for emphasized panels, popovers, and hover elevation.

## Typography

### Font families

- Display serif: Lora
- UI sans: Nunito

Both are loaded in src/web/src/app/layout.tsx and exposed as CSS vars:

- --font-lora
- --font-nunito

### Type scale and usage

| Usage | Font | Size | Weight | Notes |
| --- | --- | --- | --- | --- |
| Page title | Lora | 2rem (or clamp on Settings) | 700 | Used in all audited pages |
| Section/card title | Lora | 1rem to 1.35rem | 700 | Card and module headings |
| KPI number | Lora | 2rem to 3rem+ | 700 | Stats and progress emphasis |
| Eyebrow label | Nunito | 0.72rem to 0.78rem | 700-800 | Uppercase + tracked |
| Body text | Nunito | 0.88rem to 0.98rem | 500-600 | Descriptions and helper copy |
| Metadata | Nunito | 0.65rem to 0.78rem | 600-700 | Dates, badges, legends |

### Text styling conventions

- Eyebrows: uppercase, letter-spacing 0.12em, accent color.
- Long-form helper copy uses muted text color.
- Display titles use serif and tight line-height (about 1.05 to 1.2).

## Logo usage

Current implementation lives in src/web/src/components/layout/app-shell.tsx.

### Approved marks

- Full header lockup: chef hat icon + Copilot Chef wordmark (default)
- Icon-only mark: chef hat icon for constrained contexts
- Monochrome mark: white mark on green surfaces only

### Sizing and spacing

- Header height: 64px
- Logo icon size: 22x22px
- Icon-to-wordmark gap: 0.5rem
- Maintain at least 0.5rem clear space around the full mark

### Incorrect usage

- Do not place the full logo on cream gradients without a dark backing.
- Do not substitute fonts for the wordmark.
- Do not rotate or recolor the wordmark text.

## Spacing and layout

### Global container

From app shell:

- Desktop page frame: max-width 1200px; padding 2rem 2rem 4rem
- Mobile frame (<=768px): padding 1.25rem 1rem 3rem

### Common spacing rhythm

- Card radius: 16px to 18px
- Control radius: 8px to 12px
- Large section gap: 1.25rem to 1.75rem
- Small row gap: 0.4rem to 0.8rem

### Page header pattern

Shared by Meal Plan, Grocery List, and Settings:

- Left cluster: eyebrow, page title, short subtitle
- Right cluster: primary action and context controls
- Layout: wrap-friendly flex row with 1rem gap

### Grids in production

- Home overview: auto + 1fr
- Grocery page: 260px + 1fr
- Stats sections: 2-column at large breakpoints
- Settings card forms: 2-column collapsing to 1-column at <=768px
- Calendar week board: 128px + 7 columns with horizontal overflow support

### Breakpoints in active use

- 900px: calendar controls and board adjustments
- 768px: nav collapse and settings grid collapse
- 600px: persona grid reduction
- 480px: compact spacing refinements

## UI components

### Navigation shell

- Sticky top bar with green background and white text.
- Desktop nav uses subtle translucent active backgrounds.
- Mobile menu appears below header with orange bottom border.

### Cards

Base card pattern used across Home, Grocery, Stats, and Settings:

- Surface: var(--white)
- Border: 1px solid rgba(59, 94, 69, 0.08 to 0.12)
- Radius: 16px to 18px
- Shadow: --shadow

### Buttons

Primary variants from src/web/src/components/ui/button.tsx:

- default: green background, white text
- accent: orange background, white text
- outline: cream background, bordered neutral
- ghost: text-only green action

Page-specific use:

- Meal Plan primary action uses green add button.
- Grocery primary page action uses orange new-list button.
- Settings destructive actions use red-tinted outline treatment.

### Inputs and controls

- Inputs are cream-toned with 1 to 1.5px neutral borders.
- Focus ring: green border plus soft green outline glow.
- Segmented controls and filter tabs use rounded pill geometry.
- Toggle switches use compact 36x20 track with white thumb.

### Status and metadata elements

- Eyebrows and section labels rely on uppercase tracked Nunito.
- Progress indicators use rounded tracks and green gradients.
- Pill badges and tiny labels stay within 0.65rem to 0.75rem range.

### Data visualization

- All charts are wrapped in standard white cards.
- Grid lines use #E4DDD0 with dashed style for low visual noise.
- Tooltip surfaces use warm white with soft border and rounded 8px corners.
- Heatmap cells are square with subtle hover scale motion.

### Modal and popover surfaces

- Overlay dimming from translucent dark layer.
- Panel surface stays warm white/cream with large radius.
- Entry animation: subtle fade and upward motion.

## Iconography

Current icon language is mixed but intentional:

- Utility icons: simple SVG icons (chef hat, settings, chart marks)
- Lightweight emoji accents: used in labels and persona cards
- Dot indicators: color dots for meal type and activity intensity

Guidelines:

- Use outline or simple filled icons with minimal detail.
- Keep icon sizes between 16px and 22px in controls.
- Avoid introducing heavy multi-color illustration icons.

## Imagery and photography

Current product styling is icon-led, not photography-led.

- No stock photography in the audited pages.
- Background identity comes from gradient atmosphere and card layering.
- If photography is introduced in future pages, use warm natural-light food imagery with low saturation and avoid high-contrast studio looks.

## Voice and tone for UI copy

Observed voice across the audited pages:

- Practical and encouraging
- Brief and directive
- Warm but not playful in critical actions

Copy rules:

- Prefer concise imperatives for actions: Add Meal, Open List, Today.
- Keep helper text one sentence where possible.
- Error and destructive copy should remain neutral and explicit.

## Code tokens and implementation references

### CSS tokens

Use src/web/src/app/globals.css as the source of truth for CSS variables.

### Tailwind mappings

Use src/web/tailwind.config.ts for framework-level token parity:

- colors.green, colors.cream, colors.orange, colors.text, colors.white
- borderRadius.card, borderRadius.btn, borderRadius.chip
- boxShadow.card, boxShadow.lg

### Component tokens

Use src/web/src/components/ui/button.tsx variants to avoid one-off button styling in new pages unless a page-specific CTA treatment is required.

## Accessibility baseline

WCAG contrast checks for key production pairs:

| Pair | Contrast | Result |
| --- | --- | --- |
| #2C2416 on #F5F0E8 | 13.50:1 | Pass AAA |
| #2C2416 on #FFFDF8 | 15.07:1 | Pass AAA |
| #7A6A58 on #F5F0E8 | 4.59:1 | Pass AA for normal text |
| #3B5E45 on #FFFDF8 | 7.19:1 | Pass AAA |
| #FFFDF8 on #C5622A | 4.01:1 | Pass AA for large text only |
| #C5622A on #F5F0E8 | 3.59:1 | Pass AA for large text only |

Implementation rules:

- Keep body text at or above 0.875rem when using muted color.
- Avoid using orange as the only carrier for small text.
- Preserve focus-visible outlines on interactive elements.
- Ensure keyboard navigation for tabs, modals, popovers, and list actions.

## New page checklist

- Use the global page frame and warm gradient background.
- Start with eyebrow + serif title + muted subtitle.
- Build content from card surfaces using existing radii and shadows.
- Use button variants from shared UI primitives first.
- Reuse section labels and progress visual language.
- Verify color contrast for any newly introduced combinations.

## Version history

| Version | Date | Summary |
| --- | --- | --- |
| 1.0 | 2026-03-17 | Initial design system grounded in Home, Meal Plan, Grocery List, Stats, and Settings implementation |
