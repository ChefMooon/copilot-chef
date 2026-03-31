import { prisma } from "./prisma";

const SCHEMA_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS "Meal" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "date" DATETIME DEFAULT CURRENT_TIMESTAMP,
      "mealType" TEXT NOT NULL,
      "notes" TEXT,
      "ingredientsJson" TEXT NOT NULL DEFAULT '[]',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `CREATE INDEX IF NOT EXISTS "Meal_date_idx" ON "Meal"("date")`,
  `
    CREATE TABLE IF NOT EXISTS "GroceryList" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "favourite" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `CREATE INDEX IF NOT EXISTS "GroceryList_date_idx" ON "GroceryList"("date")`,
  `
    CREATE TABLE IF NOT EXISTS "GroceryItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "groceryListId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "qty" TEXT,
      "unit" TEXT,
      "category" TEXT NOT NULL DEFAULT 'Other',
      "notes" TEXT,
      "meal" TEXT,
      "checked" INTEGER NOT NULL DEFAULT 0,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "GroceryItem_groceryListId_fkey"
        FOREIGN KEY ("groceryListId") REFERENCES "GroceryList" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `,
  `CREATE INDEX IF NOT EXISTS "GroceryItem_groceryListId_sortOrder_idx" ON "GroceryItem"("groceryListId", "sortOrder")`,
  `
    CREATE TABLE IF NOT EXISTS "UserPreference" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "householdSize" INTEGER NOT NULL DEFAULT 2,
      "cookingLength" TEXT NOT NULL DEFAULT 'weeknight',
      "dietaryTags" TEXT NOT NULL DEFAULT '',
      "favoriteCuisines" TEXT NOT NULL DEFAULT '',
      "avoidCuisines" TEXT NOT NULL DEFAULT '',
      "avoidIngredients" TEXT NOT NULL DEFAULT '[]',
      "pantryStaples" TEXT NOT NULL DEFAULT '[]',
      "planningNotes" TEXT NOT NULL DEFAULT '',
      "nutritionTags" TEXT NOT NULL DEFAULT '',
      "skillLevel" TEXT NOT NULL DEFAULT 'home-cook',
      "budgetRange" TEXT NOT NULL DEFAULT 'moderate',
      "chefPersona" TEXT NOT NULL DEFAULT 'coach',
      "replyLength" TEXT NOT NULL DEFAULT 'balanced',
      "emojiUsage" TEXT NOT NULL DEFAULT 'occasional',
      "autoImproveChef" INTEGER NOT NULL DEFAULT 1,
      "contextAwareness" INTEGER NOT NULL DEFAULT 1,
      "seasonalAwareness" INTEGER NOT NULL DEFAULT 1,
      "seasonalRegion" TEXT NOT NULL DEFAULT 'eastern-us',
      "proactiveTips" INTEGER NOT NULL DEFAULT 0,
      "autoGenerateGrocery" INTEGER NOT NULL DEFAULT 1,
      "consolidateIngredients" INTEGER NOT NULL DEFAULT 1,
      "defaultPlanLength" TEXT NOT NULL DEFAULT '7',
      "groceryGrouping" TEXT NOT NULL DEFAULT 'category',
      "defaultRecipeView" TEXT NOT NULL DEFAULT 'basic',
      "defaultUnitMode" TEXT NOT NULL DEFAULT 'cup',
      "saveChatHistory" INTEGER NOT NULL DEFAULT 1,
      "reasoningEffort" TEXT NOT NULL DEFAULT ''
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS "Recipe" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "servings" INTEGER NOT NULL DEFAULT 2,
      "prepTime" INTEGER,
      "cookTime" INTEGER,
      "difficulty" TEXT,
      "instructions" TEXT NOT NULL,
      "sourceUrl" TEXT,
      "sourceLabel" TEXT,
      "origin" TEXT NOT NULL DEFAULT 'manual',
      "rating" INTEGER,
      "cookNotes" TEXT,
      "lastMadeAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `CREATE INDEX IF NOT EXISTS "Recipe_title_idx" ON "Recipe"("title")`,
  `CREATE INDEX IF NOT EXISTS "Recipe_origin_idx" ON "Recipe"("origin")`,
  `CREATE INDEX IF NOT EXISTS "Recipe_sourceUrl_idx" ON "Recipe"("sourceUrl")`,
  `
    CREATE TABLE IF NOT EXISTS "RecipeIngredient" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "recipeId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "quantity" REAL,
      "unit" TEXT,
      "notes" TEXT,
      "order" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "RecipeIngredient_recipeId_fkey"
        FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `,
  `CREATE INDEX IF NOT EXISTS "RecipeIngredient_recipeId_order_idx" ON "RecipeIngredient"("recipeId", "order")`,
  `CREATE INDEX IF NOT EXISTS "RecipeIngredient_name_idx" ON "RecipeIngredient"("name")`,
  `
    CREATE TABLE IF NOT EXISTS "RecipeTag" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "recipeId" TEXT NOT NULL,
      "tag" TEXT NOT NULL,
      CONSTRAINT "RecipeTag_recipeId_fkey"
        FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RecipeTag_recipeId_tag_key" ON "RecipeTag"("recipeId", "tag")`,
  `CREATE INDEX IF NOT EXISTS "RecipeTag_tag_idx" ON "RecipeTag"("tag")`,
  `
    CREATE TABLE IF NOT EXISTS "RecipeLink" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "parentId" TEXT NOT NULL,
      "subRecipeId" TEXT NOT NULL,
      CONSTRAINT "RecipeLink_parentId_fkey"
        FOREIGN KEY ("parentId") REFERENCES "Recipe" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "RecipeLink_subRecipeId_fkey"
        FOREIGN KEY ("subRecipeId") REFERENCES "Recipe" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RecipeLink_parentId_subRecipeId_key" ON "RecipeLink"("parentId", "subRecipeId")`,
  `CREATE INDEX IF NOT EXISTS "RecipeLink_subRecipeId_idx" ON "RecipeLink"("subRecipeId")`,
  `
    CREATE TABLE IF NOT EXISTS "ChatSession" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "ownerId" TEXT NOT NULL DEFAULT 'web-default',
      "copilotSessionId" TEXT,
      "title" TEXT,
      "state" TEXT NOT NULL DEFAULT 'idle',
      "pendingInputRequestId" TEXT,
      "pendingQuestion" TEXT,
      "pendingChoicesJson" TEXT,
      "pendingAllowFreeform" INTEGER NOT NULL DEFAULT 1,
      "pendingRequestedAt" DATETIME,
      "pendingRetryCount" INTEGER NOT NULL DEFAULT 0,
      "pendingLastErrorCode" TEXT,
      "pendingLastRequestId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `CREATE INDEX IF NOT EXISTS "ChatSession_ownerId_updatedAt_idx" ON "ChatSession"("ownerId", "updatedAt")`,
  `CREATE INDEX IF NOT EXISTS "ChatSession_ownerId_state_updatedAt_idx" ON "ChatSession"("ownerId", "state", "updatedAt")`,
  `
    CREATE TABLE IF NOT EXISTS "ChatMessage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "chatSessionId" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ChatMessage_chatSessionId_fkey"
        FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `,
  `CREATE INDEX IF NOT EXISTS "ChatMessage_chatSessionId_createdAt_idx" ON "ChatMessage"("chatSessionId", "createdAt")`,
  `
    CREATE TABLE IF NOT EXISTS "ChatAction" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "chatSessionId" TEXT NOT NULL,
      "domain" TEXT NOT NULL,
      "actionType" TEXT NOT NULL,
      "summary" TEXT NOT NULL,
      "forwardJson" TEXT NOT NULL,
      "inverseJson" TEXT NOT NULL,
      "undoneAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ChatAction_chatSessionId_fkey"
        FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `,
  `CREATE INDEX IF NOT EXISTS "ChatAction_chatSessionId_createdAt_idx" ON "ChatAction"("chatSessionId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "ChatAction_chatSessionId_undoneAt_idx" ON "ChatAction"("chatSessionId", "undoneAt")`,
  `
    CREATE TABLE IF NOT EXISTS "ChatPendingSuggestion" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "chatSessionId" TEXT NOT NULL,
      "domain" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "payloadJson" TEXT NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ChatPendingSuggestion_chatSessionId_fkey"
        FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `,
  `CREATE INDEX IF NOT EXISTS "ChatPendingSuggestion_chatSessionId_createdAt_idx" ON "ChatPendingSuggestion"("chatSessionId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "ChatPendingSuggestion_chatSessionId_expiresAt_idx" ON "ChatPendingSuggestion"("chatSessionId", "expiresAt")`,
  `
    CREATE TABLE IF NOT EXISTS "MealLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "date" DATETIME NOT NULL,
      "mealType" TEXT NOT NULL,
      "mealName" TEXT NOT NULL,
      "cooked" INTEGER NOT NULL DEFAULT 1,
      "mealId" TEXT,
      CONSTRAINT "MealLog_mealId_fkey"
        FOREIGN KEY ("mealId") REFERENCES "Meal" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `,
  `CREATE INDEX IF NOT EXISTS "MealLog_date_idx" ON "MealLog"("date")`,
  `
    CREATE TABLE IF NOT EXISTS "CustomPersona" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "emoji" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "prompt" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
] as const;

export async function ensureDatabaseSchema(): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await prisma.$executeRawUnsafe(statement);
  }
}