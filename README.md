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
  - Prisma SQLite schema for meals, grocery lists, grocery items, user preferences, and meal logs
  - Seeded local data for the MVP experience
  - Service layer for meals, grocery lists, preferences, and meal activity
  - `CopilotChef` chat orchestration with quick-prompt aware responses
- `src/web`
  - Next.js App Router setup
  - Tailwind token config matching the Copilot Chef style guide
  - shadcn-style `Button`, `Input`, and `Textarea` primitives
  - Custom CSS modules for the header shell and landing page chat/heatmap layouts
  - Home landing page based on the provided prototype
  - **Chat interface** with ChatPanel, ChatWidget, SlashCommandMenu, and session management
  - Inline choice buttons for guided assistant responses
  - Slash commands for quick meal planning and grocery list actions
  - ChatContext for managing chat state, messages, and page context awareness
  - Basic Calendar, Meal Plan, Grocery List, Settings, and Stats pages ready for later customization
  - API routes for chat, meals, grocery lists, preferences, meal logs, and stats

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- GitHub Copilot CLI (for authentication; run `copilot login` before starting the dev server)

### Initial Setup

```bash
# Install dependencies across all workspaces
npm install

# Generate Prisma client
npm run db:generate

# Create and initialize the SQLite database with schema
npm run db:push

# Seed the database with sample meals, preferences, and grocery lists
npm run db:seed
```

### Run The Development Server

```bash
npm run dev
```

This starts the Next.js dev server from `src/web` on `http://localhost:3000`.

**Note:** Ensure you have run `copilot login` before starting the dev server to authenticate with the GitHub Copilot SDK.

### Build for Production

```bash
npm run build
```

Compiles both `src/core` (TypeScript) and `src/web` (Next.js) into optimized dist/build directories.

## Configuration

### Environment Variables

- **Root `.env.example`**: Documents global app configuration (DATABASE_URL, NEXT_PUBLIC_APP_NAME, COPILOT_MODEL)
- **`src/core/.env`**: Used by Prisma CLI for database operations
- **`src/web/.env.local`** (create if needed): Override `COPILOT_MODEL` for the web app; Next.js reads this automatically

For testing with a different Copilot model, set `COPILOT_MODEL` in `src/web/.env.local` (e.g., `COPILOT_MODEL=gpt-4-turbo`).

### Database

The SQLite database is created at `src/core/prisma/copilot-chef.db` after running `npm run db:push` and `npm run db:seed`.

Seed data includes:

- Sample meals organized by day and meal type
- User preferences (dietary restrictions, household size, cuisine preferences)
- Sample grocery lists and items
- Indexed lookups for efficient queries
