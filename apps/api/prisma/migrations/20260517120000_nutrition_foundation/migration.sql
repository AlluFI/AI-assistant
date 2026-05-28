-- CreateTable
CREATE TABLE "NutritionProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "dislikedIngredients" JSONB NOT NULL DEFAULT '[]',
    "cuisinePreferences" JSONB NOT NULL DEFAULT '[]',
    "calorieTarget" INTEGER,
    "calorieTargetSource" TEXT,
    "macroTargets" JSONB,
    "mealsPerDay" INTEGER NOT NULL DEFAULT 3,
    "snacksPerDay" INTEGER NOT NULL DEFAULT 0,
    "preferredMealTimes" JSONB,
    "nutritionConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'gram',
    "quantity" INTEGER NOT NULL DEFAULT 100,
    "nutrition" JSONB NOT NULL,
    "embedding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cuisine" TEXT NOT NULL,
    "meal" TEXT NOT NULL,
    "servings" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "timeMinutes" INTEGER NOT NULL,
    "difficultyLevel" TEXT NOT NULL,
    "dietaryTags" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "img" TEXT,
    "preparation" JSONB NOT NULL,
    "embedding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecipeIngredient" (
    "recipeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("recipeId","ingredientId")
);

CREATE TABLE "MealPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealPlanVersion" (
    "id" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "generationSteps" JSONB,
    "preferencesSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealPlanVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlannedMeal" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL DEFAULT 0,
    "mealType" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "recipeId" TEXT,
    "nutrition" JSONB NOT NULL,
    "alternatives" JSONB,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlannedMeal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShoppingList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealPlanVersionId" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShoppingListItem" (
    "id" TEXT NOT NULL,
    "shoppingListId" TEXT NOT NULL,
    "ingredientId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantityGrams" DOUBLE PRECISION,
    "quantityMl" DOUBLE PRECISION,
    "excluded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ShoppingListItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NutritionDayLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "calories" INTEGER NOT NULL DEFAULT 0,
    "protein" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fats" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'planned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionDayLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NutritionProfile_userId_key" ON "NutritionProfile"("userId");
CREATE INDEX "Ingredient_label_idx" ON "Ingredient"("label");
CREATE INDEX "Recipe_cuisine_idx" ON "Recipe"("cuisine");
CREATE INDEX "Recipe_meal_idx" ON "Recipe"("meal");
CREATE INDEX "Recipe_title_idx" ON "Recipe"("title");
CREATE INDEX "MealPlan_userId_startDate_idx" ON "MealPlan"("userId", "startDate");
CREATE INDEX "MealPlanVersion_mealPlanId_versionNumber_idx" ON "MealPlanVersion"("mealPlanId", "versionNumber");
CREATE INDEX "PlannedMeal_versionId_dayIndex_sortOrder_idx" ON "PlannedMeal"("versionId", "dayIndex", "sortOrder");
CREATE INDEX "ShoppingList_userId_createdAt_idx" ON "ShoppingList"("userId", "createdAt");
CREATE INDEX "ShoppingListItem_shoppingListId_idx" ON "ShoppingListItem"("shoppingListId");
CREATE UNIQUE INDEX "NutritionDayLog_userId_date_source_key" ON "NutritionDayLog"("userId", "date", "source");
CREATE INDEX "NutritionDayLog_userId_date_idx" ON "NutritionDayLog"("userId", "date");

ALTER TABLE "NutritionProfile" ADD CONSTRAINT "NutritionProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealPlanVersion" ADD CONSTRAINT "MealPlanVersion_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlannedMeal" ADD CONSTRAINT "PlannedMeal_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "MealPlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlannedMeal" ADD CONSTRAINT "PlannedMeal_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_mealPlanVersionId_fkey" FOREIGN KEY ("mealPlanVersionId") REFERENCES "MealPlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_shoppingListId_fkey" FOREIGN KEY ("shoppingListId") REFERENCES "ShoppingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NutritionDayLog" ADD CONSTRAINT "NutritionDayLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
