# Copilot Chef

Copilot Chef is a Phase 1 meal-planning MVP built as a small monorepo inside `src/`. It includes a Prisma-backed core package, a Next.js web app, a styled landing page based on the provided prototype, and placeholder routes for the remaining Phase 1 screens.

## Workspace Layout

```text
src/
  core/   Shared Prisma models, seed data, services, and CopilotChef orchestration
  web/    Next.js App Router UI with Tailwind tokens, shadcn-style primitives, and custom CSS modules
```

## Implemented Phase 1 Scope

- `src/core`
  - Prisma SQLite schema for meal plans, meals, grocery lists, grocery items, user preferences, and meal logs
  - Seeded local data for the MVP experience
  - Service layer for meal plans, grocery lists, preferences, and meal activity
  - `CopilotChef` chat orchestration with quick-prompt aware responses
- `src/web`
  - Next.js App Router setup
  - Tailwind token config matching the Copilot Chef style guide
  - shadcn-style `Button`, `Input`, and `Textarea` primitives
  - Custom CSS modules for the header shell and landing page chat/heatmap layouts
  - Home landing page based on the provided prototype
  - Basic Calendar, Meal Plan, Grocery List, Settings, and Stats pages ready for later customization
  - API routes for chat, meal plans, grocery lists, preferences, and meal logs

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
```

### Run The Web App

```bash
npm run dev
```

This starts the Next.js app from `src/web`.

### Build

```bash
npm run build
```

## Notes

- The tracked environment example is in `.env.example`.
- The Prisma CLI uses `src/core/.env` locally for workspace commands.
- The web app uses the shared core package and the local SQLite database seeded during setup.
