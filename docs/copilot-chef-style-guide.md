# Copilot Chef — UI Style Guide

> Reference document for building all pages of the Copilot Chef web application. All new pages and components should follow these conventions to maintain a consistent, warm, and cozy aesthetic.

---

## Brand Identity

**Name:** Copilot Chef  
**Logo:** 🍳 + wordmark in Lora serif  
**Tone:** Warm, cozy, earthy — like a premium cooking journal meets a smart productivity app. Approachable but organized.

---

## Color Palette

All colors are defined as CSS custom properties on `:root`.

| Variable | Hex | Usage |
|---|---|---|
| `--green` | `#3B5E45` | Primary brand color. Header background, buttons, active states, filled elements |
| `--green-light` | `#5A7D63` | Hover states, progress fills, secondary accents |
| `--green-pale` | `#D4E4D8` | Chip/badge backgrounds, hover backgrounds, subtle highlights |
| `--cream` | `#F5F0E8` | Page background, input backgrounds, assistant chat bubbles |
| `--cream-dark` | `#EDE6D6` | Dividers, borders, card inner borders, progress bar tracks |
| `--orange` | `#C5622A` | Primary CTA buttons, accent highlights, eyebrow text |
| `--orange-light` | `#E8885A` | Hover state for orange buttons |
| `--text` | `#2C2416` | Primary text, headings |
| `--text-muted` | `#7A6A58` | Secondary text, labels, metadata, placeholders |
| `--white` | `#FFFDF8` | Card backgrounds (warm white, not pure white) |

### Shadows

```css
--shadow:    0 2px 12px rgba(44,36,22,0.10);   /* Default card shadow */
--shadow-lg: 0 6px 28px rgba(44,36,22,0.14);   /* Elevated elements, chat panel */
```

### Heatmap Colors

Used specifically for the Meal Activity heatmap:

| Level | Hex | Meaning |
|---|---|---|
| Empty / no meals | `#E4DDD0` | No data |
| 1 meal | `#A8C8B0` | Light activity |
| 2 meals | `#6FA882` | Moderate activity |
| 3 meals | `#3B5E45` (`--green`) | High activity |
| Future date | `var(--cream-dark)` | Greyed out |

---

## Typography

Two fonts are used throughout the app — always load both from Google Fonts.

```html
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Nunito:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Lora (Serif) — Display & Headings

Used for: logo, page titles, card titles, section headings, large stat numbers, meal names.

| Use | Size | Weight |
|---|---|---|
| Logo / wordmark | `1.45rem` | `700` |
| Page greeting title | `2rem` | `700` |
| Card title | `1rem` | `700` |
| Grocery stat (large number) | `2rem` | `700` |
| Meal names, list names | `0.9–0.92rem` | `600` |

### Nunito (Sans-serif) — UI & Body

Used for: navigation, labels, body copy, buttons, metadata, badges, inputs.

| Use | Size | Weight |
|---|---|---|
| Navigation links | `0.9rem` | `600` |
| Body / descriptions | `0.88–0.95rem` | `500–600` |
| Section dividers (eyebrow) | `0.72rem` | `800` — uppercase, tracked |
| Greeting eyebrow | `0.78rem` | `700` — uppercase, tracked |
| Metadata / secondary labels | `0.73–0.78rem` | `500–600` |
| Badges / tags / chips | `0.68–0.72rem` | `700` |
| Micro labels (heatmap, legend) | `0.52–0.58rem` | `700` |

### Key Typography Rules

- **Never use Inter, Roboto, Arial, or system fonts.**
- Section dividers use `text-transform: uppercase` and `letter-spacing: 0.12em`.
- Eyebrow labels above headings use `color: var(--orange)`.
- Lora italic (`font-style: italic`) can be used sparingly for decorative emphasis.

---

## Layout

### Page Container

```css
max-width: 1200px;
margin: 0 auto;
padding: 2rem 2rem 4rem;
```

### Grid System

The app uses CSS Grid for all multi-column layouts. No fixed-width columns — prefer `1fr`, `auto`, or named sizes.

| Layout | Grid definition |
|---|---|
| Two equal columns | `grid-template-columns: 1fr 1fr` |
| Auto + flexible (e.g. heatmap + grocery) | `grid-template-columns: auto 1fr` |
| Chat panel (desktop) | `grid-template-columns: 148px 1fr 185px` |
| Chat panel (≤900px) | `grid-template-columns: 148px 1fr` (prompts hidden) |
| Chat panel (≤600px) | `grid-template-columns: 1fr` (stacked) |

Standard gap between grid children: `1.25rem`.

---

## Components

### Header

- Background: `var(--green)`
- Height: `64px`, `position: sticky`, `top: 0`, `z-index: 100`
- Shadow: `0 2px 16px rgba(44,36,22,0.18)`
- Logo: 🍳 emoji + "Copilot Chef" in Lora 700
- Nav links: Nunito 600, `0.9rem`, muted white (`rgba(255,253,248,0.75)`), active state gets `rgba(255,253,248,0.18)` background
- Settings button: circular, `38×38px`, ghost style
- **Mobile:** hamburger menu appears at `≤768px` — placed to the **left** of the settings button. Opens a full-width dropdown with the same green background and an orange bottom border.

### Cards

```css
background: var(--white);
border-radius: 16px;
padding: 1.1rem 1.25rem;
box-shadow: var(--shadow);
border: 1px solid rgba(59,94,69,0.08);
```

Card headers use `display: flex; justify-content: space-between; margin-bottom: 0.75rem`. Title in Lora, action link in Nunito green.

### Section Dividers

```css
font-family: 'Nunito';
font-size: 0.72rem;
font-weight: 800;
letter-spacing: 0.12em;
text-transform: uppercase;
color: var(--text-muted);
margin: 1.25rem 0 0.8rem;
```

Include a `::after` pseudo-element with a 1px `var(--cream-dark)` line extending to fill remaining width.

### Buttons

**Primary CTA (orange):**
```css
background: var(--orange);
color: #FFFDF8;
font-family: 'Nunito';
font-size: 0.78–0.8rem;
font-weight: 700;
border-radius: 10px;
padding: 0.45rem 0.95rem;
border: none;
```
Hover: `background: var(--orange-light)`

**Ghost / nav action links:**
```css
color: var(--green);
font-size: 0.78rem;
font-weight: 700;
opacity: 0.8;
```
Hover: `opacity: 1; text-decoration: underline`

**Quick Prompt buttons (inside chat):**
```css
background: var(--cream);
border: 1px solid var(--cream-dark);
border-radius: 10px;
color: var(--text);
```
Hover: `background: var(--green-pale); border-color: var(--green-light); color: var(--green)`

### Tags & Badges

```css
font-family: 'Nunito';
font-size: 0.68rem;
font-weight: 700;
letter-spacing: 0.04em;
color: var(--orange);
background: #FDF0E8;
padding: 2px 7px;
border-radius: 5px;
```

Day badges (e.g. "Mon"):
```css
color: var(--green);
background: var(--green-pale);
border-radius: 6px;
```

### Progress Bar

```css
/* Track */
height: 8px;
background: var(--cream-dark);
border-radius: 99px;
overflow: hidden;

/* Fill */
background: linear-gradient(90deg, var(--green), #6FA882);
border-radius: 99px;
transition: width 0.5s ease;
```

### AI Chat Panel

Three-column CSS grid on desktop:

| Column | Contents |
|---|---|
| 1 — Brand bar (`148px`) | Green background, robot avatar (orange circle), "Copilot Chef AI" label, online dot |
| 2 — Messages (`1fr`) | Scrollable bubble thread, typing indicator |
| 3 — Quick Prompts (`185px`) | Prompt buttons — **desktop only, hidden ≤900px** |

Input bar spans columns 2–3 (desktop) or full width (mobile), with a send button in `var(--orange)`.

**Chat bubbles:**
```css
/* Assistant */
background: var(--cream);
border: 1px solid var(--cream-dark);
border-bottom-left-radius: 4px;
align-self: flex-start;

/* User */
background: var(--green);
color: #FFFDF8;
border-bottom-right-radius: 4px;
align-self: flex-end;
```

Typing indicator: three animated dots using `var(--text-muted)` with staggered `translateY` bounce.

### Meal Activity Heatmap

- Built with CSS Grid (`grid-template-columns: 18px repeat(13, 12px)`, `grid-template-rows: repeat(7, 12px)`)
- Gap: `3px` between all cells (uniform in both directions)
- Cells: `12×12px` fixed, `border-radius: 2px`
- Columns = weeks (left → right), Rows = days Mon–Sun (top → bottom)
- Shows **~3 months** (13 weeks) of data on the home dashboard. Full year view reserved for a dedicated Stats page.
- Month labels sit above their first week column; day labels (M/W/F only) in the leftmost column
- Card uses `width: fit-content` so cells never stretch into rectangles
- Hover shows a tooltip: date + meal count

---

## Animations

```css
/* Page load fade-up (staggered per child) */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-in { animation: fadeUp 0.38s ease both; }
/* Delay each child: 0.04s, 0.09s, 0.14s, 0.19s */

/* Chat bubble entrance */
@keyframes bubbleIn {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Typing indicator dots */
@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
  40%           { transform: translateY(-5px); opacity: 1; }
}
/* Stagger: dot 2 delay 0.18s, dot 3 delay 0.36s */
```

Card hover (interactive cards only): `transform: translateY(-2px); box-shadow: var(--shadow-lg)`

---

## Responsive Breakpoints

| Breakpoint | Behaviour |
|---|---|
| `> 900px` | Full desktop: 3-col chat (with Quick Prompts), side-by-side grids |
| `≤ 900px` | Quick Prompts hidden, chat collapses to 2-col (brand + messages) |
| `≤ 768px` | Hamburger replaces desktop nav, single-column grids, reduced padding |
| `≤ 600px` | Chat fully stacked (brand bar on top, messages, input below) |
| `≤ 480px` | Reduced header padding, smaller logo |

Mobile padding: `1.25rem 1rem 3rem`

---

## Spacing Reference

| Token | Value | Usage |
|---|---|---|
| Page padding | `2rem 2rem 4rem` | Desktop page container |
| Card padding | `1.1rem 1.25rem` | Standard card inner padding |
| Grid gap | `1.25rem` | Between grid children |
| Section divider margin | `1.25rem 0 0.8rem` | Above/below section labels |
| Card header margin-bottom | `0.75rem` | Space between card title and content |

---

## Tailwind & shadcn Integration

This project uses a **hybrid styling approach**. Tailwind and shadcn handle complex interactive components; custom CSS owns the unique, precisely-designed pieces.

### Tailwind Config

Register design tokens in `tailwind.config.ts` so all utilities stay on-brand:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        green:  { DEFAULT: "#3B5E45", light: "#5A7D63", pale: "#D4E4D8" },
        cream:  { DEFAULT: "#F5F0E8", dark: "#EDE6D6" },
        orange: { DEFAULT: "#C5622A", light: "#E8885A" },
        text:   { DEFAULT: "#2C2416", muted: "#7A6A58" },
        white:  "#FFFDF8",
      },
      fontFamily: {
        serif: ["Lora", "Georgia", "serif"],
        sans:  ["Nunito", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        btn:  "10px",
        chip: "20px",
      },
      boxShadow: {
        card: "0 2px 12px rgba(44,36,22,0.10)",
        lg:   "0 6px 28px rgba(44,36,22,0.14)",
      },
    },
  },
};
export default config;
```

### shadcn CSS Variable Overrides

Remap shadcn's default tokens in `globals.css` to the Copilot Chef palette:

```css
:root {
  --background:         #F5F0E8;  /* cream */
  --foreground:         #2C2416;  /* text */
  --card:               #FFFDF8;  /* white */
  --card-foreground:    #2C2416;
  --primary:            #3B5E45;  /* green */
  --primary-foreground: #FFFDF8;
  --secondary:          #D4E4D8;  /* green-pale */
  --secondary-foreground: #3B5E45;
  --muted:              #EDE6D6;  /* cream-dark */
  --muted-foreground:   #7A6A58;  /* text-muted */
  --accent:             #C5622A;  /* orange */
  --accent-foreground:  #FFFDF8;
  --border:             #EDE6D6;
  --input:              #EDE6D6;
  --ring:               #3B5E45;
  --radius:             10px;
}
```

### Decision Guide

| Situation | Approach |
|---|---|
| Layout, spacing, flex/grid helpers | Tailwind utilities |
| Colors, shadows, border-radius | Tailwind utilities via configured tokens |
| Button, Input, Select, Textarea | shadcn + CSS variable overrides |
| Dialog, Sheet, Dropdown, Command | shadcn + CSS variable overrides |
| DatePicker, Toast, Tooltip, Badge | shadcn + CSS variable overrides |
| Header, nav drawer, section dividers | Custom CSS — too specific for utilities |
| Card components | Custom CSS — intentional shadow, border, and spacing |
| Heatmap grid | Custom CSS Grid — fixed 12×12px cells, never `1fr` |
| Chat panel 3-column layout | Custom CSS Grid |
| Progress bar | Custom CSS — gradient fill, specific height |
| Animations (fadeUp, bubbleIn, bounce) | Custom CSS keyframes |

---

## Page Inventory

| Page | Status | Notes |
|---|---|---|
| Home | ✅ Designed | Dashboard with chat, heatmap, grocery summary |
| Meal Plan | ✅ Implemented | Interactive calendar (day/week/month) with meal editing and AI suggestions |
| Grocery List | 🔲 Pending | Create and edit grocery lists |
| Settings | 🔲 Pending | Accessible via ⚙️ icon, dietary prefs, household size |
| Stats | 🔲 Pending | Full-year heatmap + meal stats and insights |
