# Copilot Chef 🍴

> A personal AI meal planning assistant powered by the GitHub Copilot SDK. Chat naturally to plan your weekly meals and generate smart grocery lists — accessible from your browser, terminal, or Telegram.

---

## Project Overview

|                |                                                     |
| -------------- | --------------------------------------------------- |
| **Name**       | Copilot Chef                                        |
| **Language**   | TypeScript                                          |
| **Runtime**    | Node.js                                             |
| **AI Layer**   | GitHub Copilot SDK                                  |
| **Interfaces** | Web UI (Phase 1), TUI (Phase 2), Telegram (Phase 3) |

---

## Architecture

```
copilot-chef/
├── core/               ← Shared: Copilot SDK logic, Prisma, types, utilities
├── web/                ← Next.js app (browser UI)
├── cli/                ← Ink terminal UI
├── package.json        ← npm workspaces root
└── tsconfig.base.json  ← Shared TypeScript config
```

The project is structured as an **npm monorepo** with three packages sharing a common `core`. Each interface imports from `core` and never duplicates AI or data logic.

---

## Tech Stack

### Shared (`core/`)

| Tool               | Purpose                                                    |
| ------------------ | ---------------------------------------------------------- |
| GitHub Copilot SDK | AI orchestration and conversation                          |
| Prisma             | TypeScript-native ORM                                      |
| SQLite             | Local persistence (meals, grocery lists, preferences) |
| Zod                | Runtime schema validation for AI responses                 |

### Web Interface (`web/`)

| Tool                 | Purpose                                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js (App Router) | Full-stack React framework                                                                                                                    |
| Tailwind CSS         | Utility-first styling for layout, spacing, and typography; also used to configure design token values                                         |
| shadcn/ui            | Accessible component base for complex UI (forms, dialogs, dropdowns, date pickers, toasts) — restyled to match the Copilot Chef design system |
| React Query          | Server state, caching, and AI chat streaming                                                                                                  |

### Terminal Interface (`cli/`)

| Tool   | Purpose                                          |
| ------ | ------------------------------------------------ |
| Ink    | React-based terminal UI rendering                |
| Pastel | Ink component library for styled terminal output |

### Telegram Interface (future)

| Tool   | Purpose                            |
| ------ | ---------------------------------- |
| grammY | Telegram bot framework for Node.js |

---

## Data Models

### `Meal`

A single meal entry with a name, day of week, meal type (breakfast / lunch / dinner), and optional notes.

### `GroceryList`

A grocery list generated from scheduled meals or manually created. Contains categorized items and tracks name and dates.

### `GroceryItem`

An individual ingredient with name, quantity, unit, category (produce, dairy, meat, etc.), and a checked/unchecked state.

### `UserPreference`

Stored dietary preferences, restrictions, household size, and cuisine preferences used to personalize AI responses.

### `MealLog`

A daily log of meals that were actually cooked/eaten. Used to power the home dashboard **Meal Activity heatmap**. Each entry records a date, meal reference, and meal type. This is the historical record of what was eaten, not just what was scheduled.

---

## Pages

| Page             | Description                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Home**         | Dashboard overview: AI chat panel with quick prompts, meal activity heatmap (last 3 months), grocery list progress summary, and quick action shortcuts |
| **Meal Plan**    | Interactive calendar interface for planning and editing meals with day/week/month views, AI-powered meal suggestions, and ingredient tracking          |
| **Grocery List** | Primary interface for creating, editing, and checking off grocery lists                                                                                |
| **Settings**     | Accessible via ⚙️ icon in the header. Dietary restrictions, household size, cuisine preferences                                                        |
| **Stats**        | Full-year meal activity heatmap, meal frequency stats, cuisine breakdowns, and planning streaks                                                        |

---

## Phases

---

### Phase 1 — Core + Web UI

**Goal:** A fully functional meal planner accessible from the browser with a conversational AI interface.

#### Step 1.1 — Monorepo Setup

- Initialize npm workspaces with `core`, `web`, and `cli` packages
- Configure shared `tsconfig.base.json`
- Set up ESLint and Prettier across all packages
- Add `.env.example` with required environment variables (database path)
- Note: Copilot CLI authentication is required via `copilot login` instead of storing a token in the env file

#### Step 1.2 — Core Package

- Install and configure the GitHub Copilot SDK
- Set up Prisma with SQLite and define all data models (including `MealLog`)
- Build the `CopilotChef` class — the main AI session manager
  - `startSession()` — initialize a Copilot conversation
  - `chat(message)` — send a message and return a structured response
  - `endSession()` — gracefully close the session
- Build service layer:
  - `MealService` — CRUD for meals and date-range queries
  - `GroceryService` — generate, update, and export grocery lists
  - `PreferenceService` — read and write user preferences
  - `MealLogService` — record and query meal activity history for heatmap and stats
- Define Zod schemas for all AI response types to ensure structured output

#### Step 1.3 — AI Prompt Design

- System prompt that establishes "Copilot Chef" persona
- Context injection — include user preferences and currently scheduled meals in every message
- **Quick Prompt support** — the following pre-defined prompts should have optimized handling:
  - "Plan this week"
  - "New grocery list"
  - "Suggest a dinner"
  - "Add a meal"
  - "What's in season?"
  - "Surprise me!"
- Structured output prompts for:
  - Generating a weekly meal schedule
  - Generating a grocery list from scheduled meals
  - Modifying scheduled meals based on user feedback
  - Answering one-off cooking or nutrition questions

#### Step 1.4 — Next.js Web App

- Initialize Next.js with App Router and TypeScript
- Configure Tailwind with the Copilot Chef design tokens (colors, fonts, border radii, shadows) so utilities stay on-brand throughout the app
- Configure shadcn/ui and override its CSS variables to match the design system palette — use shadcn for any complex interactive component (forms, dialogs, dropdowns, date pickers, command palette, toasts, tooltips)
- Use **custom CSS** for the unique pieces that can't be expressed cleanly with utilities: the 3-column chat panel grid, the heatmap CSS Grid, `fit-content` card widths, and named keyframe animations
- All design tokens, font pairings, and component patterns are defined in `copilot-chef-style-guide.md` — treat it as the source of truth

**Styling decision guide:**

| Situation                                        | Approach                                                |
| ------------------------------------------------ | ------------------------------------------------------- |
| Layout, spacing, typography, flex/grid helpers   | Tailwind utilities                                      |
| Color, shadows, border-radius                    | Tailwind utilities referencing configured design tokens |
| Button, Input, Select, Dialog, Toast, DatePicker | shadcn/ui restyled with CSS variable overrides          |
| Header, nav drawer, section dividers, cards      | Custom CSS (too specific to benefit from utilities)     |
| Heatmap grid, chat panel layout, progress bar    | Custom CSS (fixed dimensions and complex grid rules)    |
| Animations (fadeUp, bubbleIn, typing bounce)     | Custom CSS keyframes                                    |

- Build API routes:
  - `/api/chat` — streaming AI chat
  - `/api/meals` — CRUD + date-range reads
  - `/api/grocery-lists` — CRUD
  - `/api/preferences` — read/write
  - `/api/meal-logs` — record and query meal activity
- Build shared layout components:
  - **Header** — sticky, green background, logo, desktop nav, hamburger (mobile), ⚙️ settings button
  - **Mobile nav drawer** — full-width dropdown with orange bottom border
  - **Section dividers** — uppercase Nunito label with extending rule line
- Build pages and their components:
  - **Home** — greeting, AI chat panel (3-col desktop layout with quick prompts), meal activity heatmap (13-week CSS grid), grocery list summary card
  - **Meal Plan** — interactive calendar (day/week/month views) for planning meals, editing meal details, viewing ingredient lists, and AI-powered resuggest functionality
  - **Grocery List** — categorized checklist with progress bar, add/remove items, export
  - **Settings** — dietary preferences form, household size, cuisine preferences
  - **Stats** — full 52-week meal activity heatmap, summary statistics

#### Step 1.5 — Heatmap Implementation Notes

The home dashboard heatmap is a core UI element and must be implemented precisely:

- Use a **CSS Grid** layout: `grid-template-columns: 18px repeat(13, 12px)` and `grid-template-rows: repeat(7, 12px)` with `gap: 3px`
- Cells are **fixed 12×12px** — never use `1fr` columns or `aspect-ratio` tricks that cause rectangles
- Columns = weeks, rows = days (Mon–Sun top to bottom)
- Card uses `width: fit-content` to prevent cell stretching
- Month labels are placed above their first week column
- Day labels show M/W/F only in the leftmost column
- The Stats page uses a full 52-week version of the same component

#### Step 1.6 — Polish & Testing

- Test full conversation flows end-to-end including quick prompts
- Validate AI structured output handling and edge cases
- Add basic unit tests for core services including `MealLogService`
- Verify responsive layout at all defined breakpoints (900px, 768px, 600px, 480px)
- Write a `README.md` with setup and run instructions

---

### Phase 2 — Terminal UI (TUI)

**Goal:** Full feature parity with the web UI, accessible from the terminal using Ink.

#### Step 2.1 — CLI Package Setup

- Initialize the `cli` package and install Ink and Pastel
- Set up a CLI entry point via `package.json` `bin` field
- Wire up the same `core` services used by the web app

#### Step 2.2 — TUI Components

- **Chat panel** — scrollable message history with an input field at the bottom
- **Meal plan view** — formatted weekly grid using Ink's box/column layout
- **Grocery list view** — categorized list with keyboard-navigable checkboxes
- **Preferences screen** — form-style input for updating user preferences

#### Step 2.3 — Navigation

- Tab or keyboard-driven navigation between views
- Status bar showing active view and quick-key hints
- Graceful exit handling

---

### Phase 3 — Telegram Integration

**Goal:** Control Copilot Chef remotely from Telegram on any device.

#### Step 3.1 — Bot Setup

- Register a Telegram bot via BotFather
- Install and configure grammY
- Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_USER_ID` to environment config

#### Step 3.2 — Bot Commands

| Command        | Description                                   |
| -------------- | --------------------------------------------- |
| `/start`       | Introduce the bot and show available commands |
| `/plan`        | Start or view the current weekly meal plan    |
| `/grocery`     | Show the current grocery list                 |
| `/add [meal]`  | Add a meal to the plan                        |
| `/preferences` | View or update dietary preferences            |
| Free text      | Passed directly to the Copilot chat session   |

#### Step 3.3 — Shared Session

- Telegram shares the same `core` session and database as the web and TUI
- Messages sent via Telegram are reflected in the web UI and vice versa

---

## Environment Variables

```env
# Copilot CLI: authenticate locally with the Copilot CLI instead of using an env token
# Run `copilot login` to authenticate the CLI before using the app

# Database
DATABASE_URL=file:./copilot-chef.db

# Telegram (Phase 3 only)
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_USER_ID=
```

---

## Getting Started (Phase 1)

```bash
# Clone the repo
git clone https://github.com/your-username/copilot-chef.git
cd copilot-chef

# Install dependencies across all workspaces
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npm run db:migrate

# Start the web app in development mode
npm run dev --workspace=web
```

---

## Design Assets

| File                          | Description                                                      |
| ----------------------------- | ---------------------------------------------------------------- |
| `copilot-chef-style-guide.md` | Full UI style guide: colors, typography, components, breakpoints |
| `copilot-chef-prototype.jsx`  | Interactive React prototype of the Home page                     |

---

## Future Ideas

- Recipe storage — save recipes mentioned in chat to a personal cookbook
- Smart substitutions — suggest ingredient swaps based on what's already in your pantry
- Nutritional summaries — weekly macro and calorie overview for a meal plan
- Export — download grocery list as PDF or share via link
- Calendar sync — push meal plan to Google Calendar
- Stats page — full year heatmap, cuisine breakdown, planning streaks _(partially scoped in Phase 1)_
