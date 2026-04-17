import { prisma } from "./prisma";
import {
  buildDuplicateRecipeTitle,
  normalizeRecipeSourceUrl,
  normalizeRecipeTitle,
  sanitizeRecipeTitle,
} from "./recipe-identity";

type TableInfoRow = {
  name: string;
};

type RecipeIdentityRow = {
  id: string;
  title: string;
  sourceUrl: string | null;
  sourceLabel: string | null;
  normalizedTitle: string | null;
  normalizedSourceUrl: string | null;
};

const SCHEMA_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS "Meal" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "date" DATETIME DEFAULT CURRENT_TIMESTAMP,
      "mealType" TEXT NOT NULL,
      "mealTypeDefinitionId" TEXT,
      "notes" TEXT,
      "ingredientsJson" TEXT NOT NULL DEFAULT '[]',
      "description" TEXT,
      "instructionsJson" TEXT NOT NULL DEFAULT '[]',
      "servings" INTEGER NOT NULL DEFAULT 2,
      "prepTime" INTEGER,
      "cookTime" INTEGER,
      "servingsOverride" INTEGER,
      "recipeId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `CREATE INDEX IF NOT EXISTS "Meal_date_idx" ON "Meal"("date")`,
  `CREATE INDEX IF NOT EXISTS "Meal_mealTypeDefinitionId_idx" ON "Meal"("mealTypeDefinitionId")`,
  `CREATE INDEX IF NOT EXISTS "Meal_recipeId_idx" ON "Meal"("recipeId")`,
  `
    CREATE TABLE IF NOT EXISTS "MealTypeProfile" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "color" TEXT NOT NULL DEFAULT '#3B5E45',
      "description" TEXT,
      "isDefault" INTEGER NOT NULL DEFAULT 0,
      "priority" INTEGER NOT NULL DEFAULT 0,
      "startDate" DATETIME,
      "endDate" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `CREATE INDEX IF NOT EXISTS "MealTypeProfile_isDefault_priority_idx" ON "MealTypeProfile"("isDefault", "priority")`,
  `CREATE INDEX IF NOT EXISTS "MealTypeProfile_startDate_endDate_priority_idx" ON "MealTypeProfile"("startDate", "endDate", "priority")`,
  `
    CREATE TABLE IF NOT EXISTS "MealTypeDefinition" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "profileId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "color" TEXT NOT NULL,
      "enabled" INTEGER NOT NULL DEFAULT 1,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MealTypeDefinition_profileId_fkey"
        FOREIGN KEY ("profileId") REFERENCES "MealTypeProfile" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `,
  `CREATE UNIQUE INDEX IF NOT EXISTS "MealTypeDefinition_profileId_slug_key" ON "MealTypeDefinition"("profileId", "slug")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "MealTypeDefinition_profileId_sortOrder_key" ON "MealTypeDefinition"("profileId", "sortOrder")`,
  `CREATE INDEX IF NOT EXISTS "MealTypeDefinition_profileId_sortOrder_idx" ON "MealTypeDefinition"("profileId", "sortOrder")`,
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
      "normalizedTitle" TEXT,
      "description" TEXT,
      "servings" INTEGER NOT NULL DEFAULT 2,
      "prepTime" INTEGER,
      "cookTime" INTEGER,
      "difficulty" TEXT,
      "instructions" TEXT NOT NULL,
      "sourceUrl" TEXT,
      "normalizedSourceUrl" TEXT,
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

async function ensureMissingColumns(
  tableName: string,
  safeAlterStatements: Record<string, string>
) {
  const rows = await prisma.$queryRawUnsafe<TableInfoRow[]>(
    `PRAGMA table_info("${tableName}")`
  );
  const existingColumns = new Set(rows.map((column) => column.name));

  for (const [columnName, statement] of Object.entries(safeAlterStatements)) {
    if (existingColumns.has(columnName)) {
      continue;
    }

    try {
      await prisma.$executeRawUnsafe(statement);
    } catch {
      // Ignore duplicate-column failures for already-migrated databases.
    }
  }
}

async function reconcileRecipeIdentityColumns() {
  const recipes = await prisma.$queryRawUnsafe<RecipeIdentityRow[]>(
    `SELECT "id", "title", "sourceUrl", "sourceLabel", "normalizedTitle", "normalizedSourceUrl" FROM "Recipe" ORDER BY "createdAt" ASC, "id" ASC`
  );

  const usedTitles = new Set<string>();
  const usedSourceUrls = new Set<string>();

  for (const recipe of recipes) {
    const baseTitle = sanitizeRecipeTitle(recipe.title) || "Untitled Recipe";
    let nextTitle = baseTitle;
    let nextNormalizedTitle = normalizeRecipeTitle(nextTitle);
    let copyNumber = 1;

    while (!nextNormalizedTitle || usedTitles.has(nextNormalizedTitle)) {
      copyNumber += 1;
      nextTitle = buildDuplicateRecipeTitle(baseTitle, copyNumber);
      nextNormalizedTitle = normalizeRecipeTitle(nextTitle);
    }

    usedTitles.add(nextNormalizedTitle);

    const canonicalSourceUrl = normalizeRecipeSourceUrl(recipe.sourceUrl);
    const nextSourceUrl =
      canonicalSourceUrl && !usedSourceUrls.has(canonicalSourceUrl)
        ? canonicalSourceUrl
        : null;

    if (nextSourceUrl) {
      usedSourceUrls.add(nextSourceUrl);
    }

    const nextNormalizedSourceUrl = nextSourceUrl;
    const nextSourceLabel = nextSourceUrl
      ? recipe.sourceLabel?.trim() || new URL(nextSourceUrl).hostname.replace(/^www\./, "")
      : null;

    if (
      nextTitle === recipe.title &&
      nextNormalizedTitle === recipe.normalizedTitle &&
      nextSourceUrl === recipe.sourceUrl &&
      nextNormalizedSourceUrl === recipe.normalizedSourceUrl &&
      nextSourceLabel === recipe.sourceLabel
    ) {
      continue;
    }

    await prisma.$executeRaw`
      UPDATE "Recipe"
      SET
        "title" = ${nextTitle},
        "normalizedTitle" = ${nextNormalizedTitle},
        "sourceUrl" = ${nextSourceUrl},
        "normalizedSourceUrl" = ${nextNormalizedSourceUrl},
        "sourceLabel" = ${nextSourceLabel}
      WHERE "id" = ${recipe.id}
    `;
  }
}

async function ensureRecipeIdentityIndexes() {
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Recipe_normalizedTitle_key" ON "Recipe"("normalizedTitle")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Recipe_normalizedSourceUrl_key" ON "Recipe"("normalizedSourceUrl")`
  );
}

export async function ensureDatabaseSchema(): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await prisma.$executeRawUnsafe(statement);
  }

  const safeMealAlterStatements = {
    mealTypeDefinitionId: `ALTER TABLE "Meal" ADD COLUMN "mealTypeDefinitionId" TEXT`,
    description: `ALTER TABLE "Meal" ADD COLUMN "description" TEXT`,
    instructionsJson: `ALTER TABLE "Meal" ADD COLUMN "instructionsJson" TEXT NOT NULL DEFAULT '[]'`,
    servings: `ALTER TABLE "Meal" ADD COLUMN "servings" INTEGER NOT NULL DEFAULT 2`,
    prepTime: `ALTER TABLE "Meal" ADD COLUMN "prepTime" INTEGER`,
    cookTime: `ALTER TABLE "Meal" ADD COLUMN "cookTime" INTEGER`,
    servingsOverride: `ALTER TABLE "Meal" ADD COLUMN "servingsOverride" INTEGER`,
    recipeId: `ALTER TABLE "Meal" ADD COLUMN "recipeId" TEXT`,
  } as const;

  const safeMealTypeProfileAlterStatements = {
    color: `ALTER TABLE "MealTypeProfile" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#3B5E45'`,
  } as const;

  const safeRecipeAlterStatements = {
    normalizedTitle: `ALTER TABLE "Recipe" ADD COLUMN "normalizedTitle" TEXT`,
    normalizedSourceUrl: `ALTER TABLE "Recipe" ADD COLUMN "normalizedSourceUrl" TEXT`,
  } as const;

  await ensureMissingColumns("Meal", safeMealAlterStatements);
  await ensureMissingColumns("MealTypeProfile", safeMealTypeProfileAlterStatements);
  await ensureMissingColumns("Recipe", safeRecipeAlterStatements);
  await reconcileRecipeIdentityColumns();
  await ensureRecipeIdentityIndexes();
}